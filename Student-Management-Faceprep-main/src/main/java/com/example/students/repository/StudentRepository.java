package com.example.students.repository;

import com.example.students.model.Student;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface StudentRepository extends MongoRepository<Student, String> {
    boolean existsByEmail(String email);
    boolean existsByStudentCode(String studentCode);
}
