package com.example.students.dto;

import java.util.List;

public record DashboardStats(long totalStudents, long activeStudents, long inactiveStudents,
                             long graduatedStudents, List<CourseCount> byCourse) {
    public record CourseCount(String course, long count) { }
}
