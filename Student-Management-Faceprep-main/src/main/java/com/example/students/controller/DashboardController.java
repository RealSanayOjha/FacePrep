package com.example.students.controller;

import com.example.students.dto.DashboardStats;
import com.example.students.service.StudentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final StudentService service;
    public DashboardController(StudentService service) { this.service = service; }

    @GetMapping("/stats")
    public DashboardStats stats() { return service.statistics(); }
}
