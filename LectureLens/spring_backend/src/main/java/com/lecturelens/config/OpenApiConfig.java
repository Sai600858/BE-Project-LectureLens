package com.lecturelens.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    public static final String SECURITY_SCHEME_NAME = "Bearer Authentication";
    public static final String SERVICE_AUTH_SCHEME_NAME = "Service HMAC Signature";

    @Bean
    public OpenAPI lectureLensOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("LectureLens Spring Boot Microservices API")
                        .description("Authoritative backend services for LectureLens multimodal AI lecture platform.")
                        .version("1.0.0")
                        .contact(new Contact().name("LectureLens Engineering").email("dev@lecturelens.edu"))
                        .license(new License().name("Proprietary")))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME,
                                new SecurityScheme()
                                        .name(SECURITY_SCHEME_NAME)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Enter your JWT token obtained from /api/auth/login"))
                        .addSecuritySchemes(SERVICE_AUTH_SCHEME_NAME,
                                new SecurityScheme()
                                        .name("X-Service-Signature")
                                        .type(SecurityScheme.Type.APIKEY)
                                        .in(SecurityScheme.In.HEADER)
                                        .description("Inter-service HMAC-SHA256 signature token")));
    }
}
