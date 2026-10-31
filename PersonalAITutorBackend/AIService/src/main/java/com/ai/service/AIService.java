package com.ai.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.rmi.ServerException;


@Service
public class AIService {
    private final ChatClient chatClient;
    public AIService(ChatClient.Builder builder){
        this.chatClient = builder.build();
    }
    public String generateContent(String promt){
        int limit = 3;
        while(limit > 0) {

            try {
                return chatClient.prompt().user(promt).call().content();
            } catch (Exception e) {
                System.out.println("Error :" + e.getMessage());
                limit--;
            }
        }
            return chatClient.prompt().user(promt).call().content();
    }

}
