package com.auth.dto;

import com.auth.entities.User;
import lombok.Data;

import java.util.UUID;

@Data
public class UserResponse {
    private UUID id;
    private String email;
    private String name;

    public UserResponse(User u){
        this.id = u.getId();
        this.email = u.getEmail();
        this.name = u.getName();
    }
}
