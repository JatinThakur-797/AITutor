package com.path.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.path.dto.LessonResourceDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class YouTubeResourceService {

    @Value("${youtube.api.key:}")
    private String youtubeApiKey;

    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;
    private final RestClient restClient = RestClient.create();

    private static final Duration CACHE_TTL = Duration.ofDays(7);

    private record VideoCandidate(
            String videoId,
            String title,
            String channel,
            long views,
            long likes,
            long durationSeconds,
            double qualityScore
    ) {}

    public List<LessonResourceDto> getTop3Videos(String goalContext, String lessonTopic) {
        if (youtubeApiKey == null || youtubeApiKey.isBlank()) {
            log.warn("YouTube API skipped for topic '{}': youtube.api.key / YOUTUBE_API_KEY is empty.", lessonTopic);
            return List.of();
        }

        String normalizedKey = "yt:top3:" + (
                (goalContext == null ? "" : goalContext) + "_" + (lessonTopic == null ? "" : lessonTopic)
        ).toLowerCase().replaceAll("[^a-z0-9]+", "_");

        try {
            Object cached = redisTemplate.opsForValue().get(normalizedKey);
            if (cached != null) {
                List<LessonResourceDto> cachedList = objectMapper.convertValue(
                        cached,
                        new TypeReference<List<LessonResourceDto>>() {}
                );
                if (!cachedList.isEmpty()) {
                    log.info("YouTube cache HIT for key '{}' ({} videos)", normalizedKey, cachedList.size());
                    return cachedList;
                }
            }
        } catch (Exception ex) {
            log.warn("Redis read error for '{}': {}", normalizedKey, ex.getMessage());
        }

        try {
            String query = (goalContext != null && !goalContext.isBlank())
                    ? goalContext + " " + lessonTopic + " tutorial"
                    : lessonTopic + " tutorial";

            log.info("Calling YouTube Data API v3 search for query: '{}'", query);

            URI searchUri = UriComponentsBuilder
                    .fromUriString("https://www.googleapis.com/youtube/v3/search")
                    .queryParam("part", "id")
                    .queryParam("type", "video")
                    .queryParam("videoEmbeddable", "true")
                    .queryParam("relevanceLanguage", "en")
                    .queryParam("maxResults", 12)
                    .queryParam("q", query)
                    .queryParam("key", youtubeApiKey)
                    .build()
                    .encode()
                    .toUri();

            Map<?, ?> searchRes = restClient.get().uri(searchUri).retrieve().body(Map.class);
            if (searchRes == null || !(searchRes.get("items") instanceof List<?> items) || items.isEmpty()) {
                log.warn("YouTube search returned 0 items for query: '{}'", query);
                return List.of();
            }

            List<String> videoIds = items.stream()
                    .filter(Map.class::isInstance)
                    .map(m -> ((Map<?, ?>) m).get("id"))
                    .filter(Map.class::isInstance)
                    .map(id -> String.valueOf(((Map<?, ?>) id).get("videoId")))
                    .filter(id -> id != null && !id.isBlank() && !"null".equals(id))
                    .distinct()
                    .toList();

            if (videoIds.isEmpty()) {
                log.warn("YouTube search items had no valid videoIds for query: '{}'", query);
                return List.of();
            }

            URI statsUri = UriComponentsBuilder
                    .fromUriString("https://www.googleapis.com/youtube/v3/videos")
                    .queryParam("part", "snippet,statistics,contentDetails")
                    .queryParam("id", String.join(",", videoIds))
                    .queryParam("key", youtubeApiKey)
                    .build()
                    .encode()
                    .toUri();

            Map<?, ?> statsRes = restClient.get().uri(statsUri).retrieve().body(Map.class);
            if (statsRes == null || !(statsRes.get("items") instanceof List<?> videoItems) || videoItems.isEmpty()) {
                log.warn("YouTube videos.list returned 0 items for IDs: {}", videoIds);
                return List.of();
            }

            List<VideoCandidate> ranked = new ArrayList<>();
            for (Object obj : videoItems) {
                if (!(obj instanceof Map<?, ?> item)) continue;

                String id = String.valueOf(item.get("id"));
                Map<?, ?> snippet = (Map<?, ?>) item.get("snippet");
                Map<?, ?> stats = (Map<?, ?>) item.get("statistics");
                Map<?, ?> content = (Map<?, ?>) item.get("contentDetails");
                if (snippet == null || stats == null || content == null) continue;

                String title = String.valueOf(snippet.get("title"));
                String channel = String.valueOf(snippet.get("channelTitle"));
                long views = parseLong(stats.get("viewCount"));
                long likes = parseLong(stats.get("likeCount"));
                long seconds = parseIsoDuration(String.valueOf(content.get("duration")));

                // Keep tutorials between 90s and 2h with at least 500 views
                if (seconds < 90 || seconds > 7200 || views < 500) continue;

                double likeRatio = (double) likes / Math.max(views, 1);
                double score = Math.log10(Math.max(views, 1)) + (likeRatio * 40.0);

                ranked.add(new VideoCandidate(id, title, channel, views, likes, seconds, score));
            }

            List<LessonResourceDto> top3 = ranked.stream()
                    .sorted(Comparator.comparingDouble(VideoCandidate::qualityScore).reversed())
                    .limit(3)
                    .map(v -> LessonResourceDto.builder()
                            .type("VIDEO")
                            .title(v.title() + " (" + v.channel() + " · " + Math.max(1, v.durationSeconds() / 60) + "m)")
                            .url("https://www.youtube.com/watch?v=" + v.videoId())
                            .build())
                    .collect(Collectors.toList());

            log.info("YouTube API selected {} videos for '{}'", top3.size(), query);

            if (!top3.isEmpty()) {
                try {
                    redisTemplate.opsForValue().set(normalizedKey, top3, CACHE_TTL);
                } catch (Exception ex) {
                    log.warn("Redis write error for '{}': {}", normalizedKey, ex.getMessage());
                }
            }

            return top3;

        } catch (Exception ex) {
            log.error("YouTube Data API error for topic '{}': {}", lessonTopic, ex.getMessage());
            return List.of();
        }
    }

    private long parseLong(Object val) {
        try {
            return val == null ? 0L : Long.parseLong(String.valueOf(val));
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private long parseIsoDuration(String iso) {
        try {
            return Duration.parse(iso).getSeconds();
        } catch (Exception e) {
            return 0L;
        }
    }
}