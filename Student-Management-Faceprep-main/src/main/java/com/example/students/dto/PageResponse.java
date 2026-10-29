package com.example.students.dto;

import java.util.List;

public record PageResponse<T>(List<T> content, int page, int size, long totalElements,
                              int totalPages, boolean first, boolean last, String sort) {
    public static <T> PageResponse<T> of(List<T> content, int page, int size, long total, String sort) {
        long pages = ((long) total + size - 1) / size;
        return new PageResponse<>(content, page, size, total, Math.toIntExact(pages),
                page == 0, pages == 0 || page >= pages - 1, sort);
    }
}
