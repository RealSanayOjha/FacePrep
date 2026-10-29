package com.example.students.dto;

import com.example.students.model.Student;
import com.example.students.model.StudentStatus;
import java.time.Instant;

public record StudentResponse(String id, String studentCode, String firstName, String lastName,
                              String email, String course, int yearLevel, StudentStatus status,
                              Instant createdAt, Instant updatedAt) {
    public static StudentResponse from(Student s) {
        return new StudentResponse(s.getId(), s.getStudentCode(), s.getFirstName(), s.getLastName(),
                s.getEmail(), s.getCourse(), s.getYearLevel(), s.getStatus(), s.getCreatedAt(), s.getUpdatedAt());
    }
}
