package com.lecturelens.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.function.RequestPredicates;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.ServerResponse;

import static org.springframework.cloud.gateway.server.mvc.filter.FilterFunctions.addResponseHeader;
import static org.springframework.cloud.gateway.server.mvc.handler.GatewayRouterFunctions.route;
import static org.springframework.cloud.gateway.server.mvc.handler.HandlerFunctions.http;

@Configuration
public class GatewayRoutesConfig {

    @Value("${lecturelens.media-service.url:http://localhost:3001}")
    private String mediaServiceUrl;

    /**
     * Spring Cloud Gateway MVC explicit routing:
     * Routes real-time Socket.IO and WebRTC media traffic to the retained Node.js mediasoup service,
     * while injecting correlation headers and proxy indicators.
     */
    @Bean
    public RouterFunction<ServerResponse> mediaServiceRoutes() {
        return route("media_service_socket_io")
                .route(RequestPredicates.path("/socket.io/**"), http(mediaServiceUrl))
                .filter(addResponseHeader("X-Gateway-Processed", "true"))
                .build();
    }
}
