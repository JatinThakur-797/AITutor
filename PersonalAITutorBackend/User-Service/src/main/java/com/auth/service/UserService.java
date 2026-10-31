package com.auth.service;

import com.auth.dto.UserResponse;
import com.auth.entities.User;
import com.auth.exeptions.AuthException;
import com.auth.exeptions.NotFoundException;
import com.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    public UserResponse getCurrentUser(Authentication auth){
        if(auth==null) throw new AuthException("Not authenticated");
        UUID userId = UUID.fromString((String) auth.getPrincipal());
        User user = userRepository.findById(userId).orElseThrow(()->new NotFoundException("User not found"));
        return new UserResponse(user);
    }
}
