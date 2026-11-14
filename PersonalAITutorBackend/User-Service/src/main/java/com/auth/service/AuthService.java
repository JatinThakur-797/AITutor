package com.auth.service;

import com.auth.dto.AuthResponse;
import com.auth.dto.LoginRequest;
import com.auth.dto.SignUpRequest;
import com.auth.dto.UserResponse;
import com.auth.entities.User;
import com.auth.exeptions.AuthException;
import com.auth.repository.UserRepository;
import com.auth.security.TokenService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.provisioning.UserDetailsManager;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final TokenService tokenService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public void registerUser(SignUpRequest request){
        if(userRepository.findByEmail(request.getEmail()).isPresent()){
            log.warn("Registration rejected: email already in use: {}", request.getEmail());
            throw new AuthException("Email already in use");
        }
        User user = new User();
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName());
        userRepository.save(user);
    }
    public AuthResponse login(LoginRequest request, HttpServletResponse response){
        User user = userRepository.findByEmail(request.getEmail()).orElseThrow(() -> new AuthException("Invalid email or password"));
        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new AuthException("Invalid email or password");
        }
        var tokens = tokenService.createTokens(user);
        tokenService.setRefreshCookie(response, tokens.refreshToken());
        return new AuthResponse(tokens.accessToken(), new UserResponse(user));
    }
    public AuthResponse refreshToken(HttpServletRequest request, HttpServletResponse response){
        String oldRefresh = tokenService.readRefreshCookie(request);
        if (oldRefresh == null || oldRefresh.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token missing");
        }
        var maybe = tokenService.refresh(oldRefresh).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token"));
        tokenService.setRefreshCookie(response, maybe.refreshToken());
        return new AuthResponse(maybe.accessToken(), null);
    }

    public void logout(HttpServletRequest request, HttpServletResponse response){
        String refresh = tokenService.readRefreshCookie(request);
        tokenService.revokeByToken(refresh);
        tokenService.clearRefreshCookie(response);
    }
}
