package com.lecturelens;

import io.swagger.v3.oas.models.OpenAPI;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.ServerResponse;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class GatewayRoutingAndHealthTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired(required = false)
    private RouterFunction<ServerResponse> mediaServiceRoutes;

    @Autowired
    private OpenAPI lectureLensOpenAPI;

    @Test
    @DisplayName("Actuator health endpoint is accessible and reports UP status")
    public void testActuatorHealthEndpoint() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("Spring Cloud Gateway MVC route definition bean is initialized for media signaling")
    public void testGatewayMediaServiceRoutesBean() {
        assertNotNull(mediaServiceRoutes, "mediaServiceRoutes RouterFunction bean must be loaded in context");
    }

    @Test
    @DisplayName("OpenAPI 3.0 documentation is configured with title and Bearer JWT security scheme")
    public void testOpenApiConfiguration() {
        assertNotNull(lectureLensOpenAPI, "OpenAPI bean must be present");
        assertNotNull(lectureLensOpenAPI.getInfo());
        assertEquals("LectureLens Spring Boot Microservices API", lectureLensOpenAPI.getInfo().getTitle());
        assertTrue(lectureLensOpenAPI.getComponents().getSecuritySchemes().containsKey("Bearer Authentication"));
        assertTrue(lectureLensOpenAPI.getComponents().getSecuritySchemes().containsKey("Service HMAC Signature"));
    }
}
