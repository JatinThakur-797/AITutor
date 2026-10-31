package com.auth.security;


import com.auth.entities.User;
import com.auth.entities.UserSocialAccount;
import com.auth.repository.UserRepository;
import com.auth.repository.UserSocialRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;
    private final UserSocialRepository userSocialRepository;

    public OAuth2User loadUser(OAuth2UserRequest userRequest){
        OAuth2User oAuth2User = super.loadUser(userRequest);
        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        Map<String, Object> attrs = oAuth2User.getAttributes();
        String providerUserId = String.valueOf(attrs.get("sub"));
        String email = (String) attrs.get("email");
        if(email == null) email = (String) attrs.get("login"); // github login field fallback
        if(providerUserId == null) providerUserId = String.valueOf(attrs.get("id"));

        Optional<UserSocialAccount> existing = userSocialRepository.findByProviderAndProviderUserId(registrationId, providerUserId);
        User user;
        if(existing.isPresent()){
            user= existing.get().getUser();
            existing.get().setLastLogin(OffsetDateTime.now());
            userSocialRepository.save(existing.get());
        }else {
            Optional<User> maybeUser = email != null ? userRepository.findByEmail(email) : Optional.empty();
            if (maybeUser.isPresent()) {
                user = maybeUser.get();
            } else{
                user = new User();
                user.setEmail(email != null ? email : registrationId + "_" + providerUserId + "@noemail.local");
                user.setName((String) attrs.getOrDefault("name", attrs.get("login")));
                userRepository.save(user);
            }
            UserSocialAccount socialAccount = new UserSocialAccount();
            socialAccount.setUser(user);
            socialAccount.setProvider(registrationId);
            socialAccount.setProviderUserId(providerUserId);
            socialAccount.setProviderEmail(email);
            socialAccount.setLastLogin(OffsetDateTime.now());
            userSocialRepository.save(socialAccount);
        }
    return oAuth2User;

    }
}
