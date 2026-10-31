package com.path;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class LearningPathGeneratorApplication {

    public static void main(String[] args) {
        SpringApplication.run(LearningPathGeneratorApplication.class, args);
    }

}
