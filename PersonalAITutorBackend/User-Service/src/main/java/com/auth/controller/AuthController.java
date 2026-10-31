package com.auth.controller;

import com.auth.dto.ApiResponse;
import com.auth.dto.AuthResponse;
import com.auth.dto.LoginRequest;
import com.auth.dto.SignUpRequest;
import com.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<ApiResponse> signup(@Valid @RequestBody SignUpRequest request){
        authService.registerUser(request);
        return ResponseEntity.ok(new ApiResponse(true, "User registered Successfully"));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response){
        System.out.println("Request of Login :" + request);
        return ResponseEntity.ok(authService.login(request, response));
    }
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest request, HttpServletResponse response) {

        return ResponseEntity.ok(authService.refreshToken(request, response));
    }
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse> logout(HttpServletRequest request, HttpServletResponse response){
        authService.logout(request, response);
        return ResponseEntity.ok(new ApiResponse(true, "Logged out Successfully"));
    }
}
