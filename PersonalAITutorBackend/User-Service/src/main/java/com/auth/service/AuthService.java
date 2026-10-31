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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.provisioning.UserDetailsManager;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final TokenService tokenService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public void registerUser(SignUpRequest request){
        if(userRepository.findByEmail(request.getEmail()).isPresent()){
            System.out.println(request);
            System.out.println("Email already in use");
            throw new AuthException("Email already in use");
        }
        System.out.println(request);
        User user = new User();
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName());
        userRepository.save(user);
        System.out.println(user);
    }
    public AuthResponse login(LoginRequest request, HttpServletResponse response){
        User user = userRepository.findByEmail(request.getEmail()).orElseThrow(() -> new AuthException("Invalid email or password"));
        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new AuthException("Invalid email or password");
        }
        var tokens = tokenService.createTokens(user);
        tokenService.setRefreshCookie(response, tokens.refreshToken());
        System.out.println("End of AuthService" + tokens.refreshToken() );
        return new AuthResponse(tokens.accessToken(), new UserResponse(user));
    }
    public AuthResponse refreshToken(HttpServletRequest request, HttpServletResponse response){
        String oldRefresh = tokenService.readRefreshCookie(request);
        System.out.println(oldRefresh);
        var maybe = tokenService.refresh(oldRefresh).orElseThrow(() -> new AuthException("Invalid refresh token"));
        tokenService.setRefreshCookie(response, maybe.refreshToken());
        return new AuthResponse(maybe.accessToken(), null);

    }

    public void logout(HttpServletRequest request, HttpServletResponse response){
        String refresh = tokenService.readRefreshCookie(request);
        tokenService.revokeByToken(refresh);
        tokenService.clearRefreshCookie(response);
    }
}
