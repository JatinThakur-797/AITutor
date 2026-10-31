package com.path.interceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class SecurityInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
       String secretHeader = request.getHeader("X-Gateway-Secret");
       if(secretHeader==null || !secretHeader.equals("Jatin@MicroserviceResult") ){
           response.setStatus(HttpServletResponse.SC_FORBIDDEN);
           response.getWriter().write("Access Denied : You must go through the API Gateway");
            return false;
       }
       return true;
    }
}
