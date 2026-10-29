package com.example.students.exception;

import java.time.Instant;
import java.util.Map;

public record ApiError(Instant timestamp, int status, String error, String message,
                       Map<String, String> fieldErrors) {
    public static ApiError of(int status, String error, String message, Map<String, String> fields) {
        return new ApiError(Instant.now(), status, error, message, fields);
    }
}
