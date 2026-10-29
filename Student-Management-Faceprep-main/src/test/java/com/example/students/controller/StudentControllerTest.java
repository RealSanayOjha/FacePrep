package com.example.students.controller;

import com.example.students.dto.StudentResponse;
import com.example.students.exception.GlobalExceptionHandler;
import com.example.students.exception.NotFoundException;
import com.example.students.model.StudentStatus;
import com.example.students.service.StudentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class StudentControllerTest {
    @Mock StudentService service;
    MockMvc mvc;
    final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    final String id = "507f1f77bcf86cd799439011";
    final String body = """
            {"studentCode":"STU-2026-001","firstName":"Ananya","lastName":"Iyer",
             "email":"ananya@example.edu","course":"Computer Science","yearLevel":2,"status":"ACTIVE"}
            """;

    @BeforeEach
    void setup() {
        mapper.enable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        mvc = MockMvcBuilders.standaloneSetup(new StudentController(service))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(mapper)).build();
    }
    StudentResponse response() {
        return new StudentResponse(id, "STU-2026-001", "Ananya", "Iyer", "ananya@example.edu",
                "Computer Science", 2, StudentStatus.ACTIVE, Instant.now(), Instant.now());
    }

    @Test
    void createReturns201AndLocation() throws Exception {
        when(service.create(any())).thenReturn(response());
        mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andExpect(header().string("Location", "/api/students/" + id))
                .andExpect(jsonPath("$.id").value(id));
    }

    @Test
    void validationReturnsFieldErrors() throws Exception {
        mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON).content(
                "{\"studentCode\":\"!\",\"firstName\":\"\",\"lastName\":\"Iyer\",\"email\":\"bad\",\"course\":\"\",\"yearLevel\":9}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.studentCode").exists())
                .andExpect(jsonPath("$.fieldErrors.firstName").exists())
                .andExpect(jsonPath("$.fieldErrors.email").exists())
                .andExpect(jsonPath("$.fieldErrors.yearLevel").exists())
                .andExpect(jsonPath("$.fieldErrors.status").exists());
        verifyNoInteractions(service);
    }

    @Test
    void duplicateReturns409WithoutInternalDetails() throws Exception {
        when(service.create(any())).thenThrow(new DuplicateKeyException("internal index details"));
        mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(
                        "A student with this email or student code already exists."));
    }

    @Test
    void missingStudentReturns404() throws Exception {
        when(service.get(id)).thenThrow(new NotFoundException("Student not found."));
        mvc.perform(get("/api/students/" + id)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void updateReturns200() throws Exception {
        when(service.update(eq(id), any())).thenReturn(response());
        mvc.perform(put("/api/students/" + id).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value("ananya@example.edu"));
    }

    @Test
    void deleteReturns204WithoutBody() throws Exception {
        mvc.perform(delete("/api/students/" + id)).andExpect(status().isNoContent())
                .andExpect(content().string(""));
        verify(service).delete(id);
    }

    @Test
    void invalidEnumReturns400() throws Exception {
        mvc.perform(get("/api/students").param("status", "UNKNOWN"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void unknownJsonPropertiesAreRejected() throws Exception {
        String trimmed = body.strip();
        String injected = trimmed.substring(0, trimmed.length() - 1) + ",\"isAdmin\":true}";
        mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON).content(injected))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void databaseOutageReturns503() throws Exception {
        when(service.get(id)).thenThrow(new DataAccessResourceFailureException("internal connection details"));
        mvc.perform(get("/api/students/" + id)).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("The database is temporarily unavailable. Please try again."));
    }
}
