package com.path.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LessonResourceDto {
    private String type;   // "VIDEO" or "DOC"
    private String title;  // Exact video or doc title
    private String url;    // Direct https://www.youtube.com/watch?v=... or official docs URL
}