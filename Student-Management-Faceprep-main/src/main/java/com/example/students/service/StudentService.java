package com.example.students.service;

import com.example.students.dto.*;
import com.example.students.exception.BadRequestException;
import com.example.students.exception.NotFoundException;
import com.example.students.model.Student;
import com.example.students.model.StudentStatus;
import com.example.students.repository.StudentRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndReplaceOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.ConditionalOperators;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

@Service
public class StudentService {
    private final StudentRepository repository;
    private final MongoTemplate mongo;

    public StudentService(StudentRepository repository, MongoTemplate mongo) {
        this.repository = repository;
        this.mongo = mongo;
    }

    public StudentResponse create(StudentRequest request) {
        Student student = new Student();
        apply(student, request);
        Instant now = Instant.ofEpochMilli(System.currentTimeMillis());
        student.setCreatedAt(now);
        student.setUpdatedAt(now);
        return StudentResponse.from(repository.insert(student));
    }

    public StudentResponse get(String id) {
        return StudentResponse.from(findStudent(id));
    }

    public StudentResponse update(String id, StudentRequest request) {
        Student student = findStudent(id);
        apply(student, request);
        student.setUpdatedAt(Instant.ofEpochMilli(System.currentTimeMillis()));
        // Atomic single-document replacement; never resurrect a concurrently deleted document.
        Student updated = mongo.findAndReplace(Query.query(Criteria.where("_id").is(id)), student,
                FindAndReplaceOptions.options().returnNew());
        if (updated == null) throw new NotFoundException("Student not found.");
        return StudentResponse.from(updated);
    }

    public void delete(String id) {
        validateId(id);
        Student removed = mongo.findAndRemove(Query.query(Criteria.where("_id").is(id)), Student.class);
        if (removed == null) throw new NotFoundException("Student not found.");
    }

    public PageResponse<StudentResponse> list(String search, String course, StudentStatus status,
                                              Integer yearLevel, int page, int size, String sortValue) {
        if (page < 0) throw new BadRequestException("page must be zero or greater.");
        if (size < 1 || size > 100) throw new BadRequestException("size must be between 1 and 100.");
        if ((long) page * size > 10_000) throw new BadRequestException("Pagination offset cannot exceed 10000.");
        if (yearLevel != null && (yearLevel < 1 || yearLevel > 6))
            throw new BadRequestException("yearLevel must be between 1 and 6.");
        checkLength(search, 100, "search");
        checkLength(course, 80, "course");
        StudentSort sort = StudentSort.parse(sortValue);

        List<Criteria> filters = new ArrayList<>();
        if (hasText(search)) filters.add(Criteria.where("$text").is(new Document("$search", search.trim())));
        if (hasText(course)) filters.add(Criteria.where("course").is(course.trim()));
        if (status != null) filters.add(Criteria.where("status").is(status.name()));
        if (yearLevel != null) filters.add(Criteria.where("yearLevel").is(yearLevel));
        Criteria criteria = filters.isEmpty() ? new Criteria()
                : new Criteria().andOperator(filters.toArray(Criteria[]::new));
        Query query = new Query(criteria);
        // Count and page are separate reads, not a transactional snapshot on standalone MongoDB.
        long total = mongo.count(query, Student.class);
        List<StudentResponse> content = mongo.find(query.with(PageRequest.of(page, size, sort.sort())), Student.class)
                .stream().map(StudentResponse::from).toList();
        return PageResponse.of(content, page, size, total, sort.name().toLowerCase(Locale.ROOT));
    }

    public DashboardStats statistics() {
        var summary = Aggregation.group()
                .count().as("totalStudents")
                .sum(statusCount("ACTIVE")).as("activeStudents")
                .sum(statusCount("INACTIVE")).as("inactiveStudents")
                .sum(statusCount("GRADUATED")).as("graduatedStudents");
        Document counts = mongo.aggregate(Aggregation.newAggregation(summary),
                mongo.getCollectionName(Student.class), Document.class).getUniqueMappedResult();
        var courses = mongo.aggregate(Aggregation.newAggregation(
                Aggregation.group("course").count().as("count"),
                Aggregation.sort(Sort.Direction.ASC, "_id")),
                mongo.getCollectionName(Student.class), Document.class).getMappedResults();
        List<DashboardStats.CourseCount> byCourse = courses.stream()
                .map(d -> new DashboardStats.CourseCount(d.getString("_id"), number(d, "count"))).toList();
        return new DashboardStats(number(counts, "totalStudents"), number(counts, "activeStudents"),
                number(counts, "inactiveStudents"), number(counts, "graduatedStudents"), byCourse);
    }

    private static ConditionalOperators.Cond statusCount(String status) {
        return ConditionalOperators.when(Criteria.where("status").is(status)).then(1).otherwise(0);
    }

    private static long number(Document document, String key) {
        if (document == null) return 0;
        Number value = (Number) document.get(key);
        return value == null ? 0 : value.longValue();
    }

    private Student findStudent(String id) {
        validateId(id);
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Student not found."));
    }

    private static void validateId(String id) {
        if (id == null || !ObjectId.isValid(id)) throw new NotFoundException("Student not found.");
    }

    private static void apply(Student student, StudentRequest request) {
        student.setStudentCode(request.studentCode().trim().toUpperCase(Locale.ROOT));
        student.setFirstName(request.firstName().trim());
        student.setLastName(request.lastName().trim());
        student.setEmail(request.email().trim().toLowerCase(Locale.ROOT));
        student.setCourse(request.course().trim());
        student.setYearLevel(request.yearLevel());
        student.setStatus(request.status());
    }

    private static boolean hasText(String value) { return value != null && !value.isBlank(); }
    private static void checkLength(String value, int max, String name) {
        if (value != null && value.length() > max)
            throw new BadRequestException(name + " cannot exceed " + max + " characters.");
    }
}
