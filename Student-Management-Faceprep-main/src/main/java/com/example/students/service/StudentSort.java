package com.example.students.service;

import com.example.students.exception.BadRequestException;
import java.util.Locale;
import org.springframework.data.domain.Sort;

/** Allowlisted sorts prevent arbitrary client-supplied query operators. */
public enum StudentSort {
    NEWEST(Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.ASC, "id"))),
    NAME(Sort.by(Sort.Direction.ASC, "lastName", "firstName").and(Sort.by(Sort.Direction.ASC, "id"))),
    YEAR(Sort.by(Sort.Direction.ASC, "yearLevel").and(Sort.by(Sort.Direction.DESC, "createdAt"))
            .and(Sort.by(Sort.Direction.ASC, "id")));

    private final Sort sort;
    StudentSort(Sort sort) { this.sort = sort; }
    public Sort sort() { return sort; }
    public static StudentSort parse(String value) {
        try { return valueOf(value.toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException ex) {
            throw new BadRequestException("sort must be one of: newest, name, year.");
        }
    }
}
