package com.example.students.dto;

import com.example.students.model.StudentStatus;
import jakarta.validation.constraints.*;

/** Client-writable fields only; IDs and timestamps are owned by the server. */
public record StudentRequest(
        @NotBlank @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9-]{2,29}",
                message = "must be 3–30 letters, digits or hyphens and start with a letter or digit")
        String studentCode,
        @NotBlank @Size(max = 60) String firstName,
        @NotBlank @Size(max = 60) String lastName,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(max = 80) String course,
        @NotNull @Min(1) @Max(6) Integer yearLevel,
        @NotNull StudentStatus status) { }
