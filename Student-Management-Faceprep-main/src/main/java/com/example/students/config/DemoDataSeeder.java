package com.example.students.config;

import com.example.students.model.Student;
import com.example.students.model.StudentStatus;
import com.example.students.repository.StudentRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Component;

/** Fictional demonstration records; never runs in the prod profile by default. */
@Component
@Order(2)
@ConditionalOnProperty(name = "app.seed-demo-data", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    private final StudentRepository repository;
    public DemoDataSeeder(StudentRepository repository) { this.repository = repository; }

    @Override
    public void run(ApplicationArguments args) {
        if (repository.count() > 0) return;
        String[][] rows = {
                {"Aarav", "Sharma", "Computer Science", "1", "ACTIVE"},
                {"Ananya", "Iyer", "Computer Science", "2", "ACTIVE"},
                {"Rohan", "Mehta", "Information Technology", "3", "ACTIVE"},
                {"Priya", "Nair", "Electronics", "4", "GRADUATED"},
                {"Arjun", "Patel", "Mechanical Engineering", "2", "ACTIVE"},
                {"Sneha", "Reddy", "Business Administration", "1", "ACTIVE"},
                {"Karan", "Singh", "Computer Science", "4", "INACTIVE"},
                {"Ishita", "Das", "Information Technology", "2", "ACTIVE"},
                {"Vikram", "Rao", "Electronics", "3", "ACTIVE"},
                {"Meera", "Joshi", "Business Administration", "4", "GRADUATED"},
                {"Aditya", "Kumar", "Mechanical Engineering", "1", "ACTIVE"},
                {"Neha", "Gupta", "Information Technology", "3", "INACTIVE"}
        };
        List<Student> students = new ArrayList<>();
        Instant now = Instant.now();
        for (int i = 0; i < rows.length; i++) {
            String[] row = rows[i];
            Student s = new Student();
            s.setStudentCode(String.format("STU-2026-%03d", i + 1));
            s.setFirstName(row[0]);
            s.setLastName(row[1]);
            s.setEmail((row[0] + "." + row[1]).toLowerCase(java.util.Locale.ROOT) + "@student.example.edu");
            s.setCourse(row[2]);
            s.setYearLevel(Integer.parseInt(row[3]));
            s.setStatus(StudentStatus.valueOf(row[4]));
            s.setCreatedAt(now.minus(i + 1L, ChronoUnit.DAYS));
            s.setUpdatedAt(s.getCreatedAt());
            students.add(s);
        }
        try {
            repository.insert(students);
            log.info("Inserted {} fictional demo students into an empty registry.", students.size());
        } catch (DuplicateKeyException ex) {
            log.info("Demo seed skipped because records already exist.");
        }
    }
}
