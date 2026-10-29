package com.example.students;

import com.example.students.dto.StudentRequest;
import com.example.students.dto.StudentResponse;
import com.example.students.model.Student;
import com.example.students.model.StudentStatus;
import com.example.students.repository.StudentRepository;
import com.mongodb.ConnectionString;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.bson.Document;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Real MongoDB tests. Requires a local MongoDB server (no Docker required).
 * Default: mongodb://127.0.0.1:27017/student_management_it
 * Override with -Dit.mongo.uri or IT_MONGODB_URI.
 * Only database names ending in _it or _test may be supplied.
 */
@SpringBootTest
@AutoConfigureMockMvc
class StudentApiIT {
    static final String EXTERNAL_URI = System.getProperty("it.mongo.uri",
            System.getenv().getOrDefault("IT_MONGODB_URI", "mongodb://127.0.0.1:27017/student_management_it"));

    static {
        String database = new ConnectionString(EXTERNAL_URI).getDatabase();
        if (database == null || !(database.endsWith("_it") || database.endsWith("_test"))) {
            throw new IllegalArgumentException("Integration database must end in _it or _test.");
        }
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", () -> EXTERNAL_URI);
        registry.add("app.indexes.auto-create", () -> "true");
        registry.add("app.seed-demo-data", () -> "false");
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired StudentRepository repository;
    @Autowired MongoTemplate mongo;

    @BeforeEach
    void clearTestData() { repository.deleteAll(); }

    StudentRequest request(String code, String email) {
        return new StudentRequest(code, "Ananya", "Iyer", email, "Computer Science", 2, StudentStatus.ACTIVE);
    }
    StudentResponse create(StudentRequest request) throws Exception {
        String json = mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(request))).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return mapper.readValue(json, StudentResponse.class);
    }
    Student saved(String code, String first, String last, String course, int year, StudentStatus status, int order) {
        Student s = new Student();
        s.setStudentCode(code); s.setFirstName(first); s.setLastName(last);
        s.setEmail(code.toLowerCase(java.util.Locale.ROOT) + "@example.edu");
        s.setCourse(course); s.setYearLevel(year); s.setStatus(status);
        s.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z").plusSeconds(order * 60L));
        s.setUpdatedAt(s.getCreatedAt());
        return repository.insert(s);
    }
    void seedFive() {
        saved("IT-001", "Ananya", "Iyer", "Computer Science", 2, StudentStatus.ACTIVE, 1);
        saved("IT-002", "Aarav", "Sharma", "Computer Science", 2, StudentStatus.ACTIVE, 2);
        saved("IT-003", "Rohan", "Mehta", "Computer Science", 2, StudentStatus.ACTIVE, 3);
        saved("IT-004", "Priya", "Nair", "Electronics", 4, StudentStatus.GRADUATED, 4);
        saved("IT-005", "Karan", "Singh", "Computer Science", 2, StudentStatus.INACTIVE, 5);
    }

    @Test
    void fullCrudLifecycle() throws Exception {
        StudentResponse created = create(request("STU-001", "ananya@example.edu"));
        assertThat(created.id()).isNotBlank();
        mvc.perform(get("/api/students/{id}", created.id())).andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("ananya@example.edu"));
        StudentRequest changed = new StudentRequest("STU-001", "Ananya", "Iyer", "ananya@example.edu",
                "Computer Science", 3, StudentStatus.GRADUATED);
        mvc.perform(put("/api/students/{id}", created.id()).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(changed))).andExpect(status().isOk())
                .andExpect(jsonPath("$.yearLevel").value(3)).andExpect(jsonPath("$.status").value("GRADUATED"))
                .andExpect(jsonPath("$.createdAt").value(created.createdAt().toString()));
        mvc.perform(delete("/api/students/{id}", created.id())).andExpect(status().isNoContent());
        mvc.perform(get("/api/students/{id}", created.id())).andExpect(status().isNotFound());
        assertThat(repository.count()).isZero();
    }

    @Test
    void emailUniquenessIsCaseInsensitiveAfterNormalization() throws Exception {
        create(request("STU-001", "ananya@example.edu"));
        mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(request("STU-002", "ANANYA@EXAMPLE.EDU"))))
                .andExpect(status().isConflict());
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void studentCodeUniquenessIsEnforcedByMongo() throws Exception {
        create(request("STU-001", "one@example.edu"));
        mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(request("stu-001", "two@example.edu"))))
                .andExpect(status().isConflict());
    }

    @Test
    void invalidBodyHasStructuredFieldErrors() throws Exception {
        mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentCode\":\"!\",\"firstName\":\"\",\"lastName\":\"\",\"email\":\"bad\",\"course\":\"\",\"yearLevel\":9}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.email").exists())
                .andExpect(jsonPath("$.fieldErrors.status").exists());
    }

    @Test
    void unknownFieldsAndMalformedJsonAreRejected() throws Exception {
        mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON).content(
                mapper.writeValueAsString(request("STU-001", "a@example.edu")).replaceFirst("}$", ",\"isAdmin\":true}")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/students").contentType(MediaType.APPLICATION_JSON).content("{bad"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void missingAndMalformedIdsReturn404() throws Exception {
        mvc.perform(get("/api/students/507f1f77bcf86cd799439011")).andExpect(status().isNotFound());
        mvc.perform(get("/api/students/not-an-id")).andExpect(status().isNotFound());
        mvc.perform(delete("/api/students/507f1f77bcf86cd799439011")).andExpect(status().isNotFound());
    }

    @Test
    void updateCannotResurrectMissingDocument() throws Exception {
        mvc.perform(put("/api/students/507f1f77bcf86cd799439011").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(request("STU-001", "a@example.edu"))))
                .andExpect(status().isNotFound());
        assertThat(repository.count()).isZero();
    }

    @Test
    void combinedFiltersAndPaginationUseDatabaseQueries() throws Exception {
        seedFive();
        mvc.perform(get("/api/students").param("course", "Computer Science").param("status", "ACTIVE")
                .param("yearLevel", "2").param("size", "2").param("page", "0"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2)).andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].studentCode").value("IT-003"))
                .andExpect(jsonPath("$.last").value(false));
        mvc.perform(get("/api/students").param("course", "Computer Science").param("status", "ACTIVE")
                .param("yearLevel", "2").param("size", "2").param("page", "1"))
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].studentCode").value("IT-001"))
                .andExpect(jsonPath("$.last").value(true));
    }

    @Test
    void textSearchFindsWholeWords() throws Exception {
        seedFive();
        mvc.perform(get("/api/students").param("search", "Sharma"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].lastName").value("Sharma"));
    }

    @Test
    void searchCannotInjectQueryOperators() throws Exception {
        seedFive();
        mvc.perform(get("/api/students").param("search", "{$ne: null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void nameSortHasStableTieBreaker() throws Exception {
        Student b = saved("IT-002", "Ananya", "Iyer", "Computer Science", 2, StudentStatus.ACTIVE, 1);
        Student a = saved("IT-001", "Ananya", "Iyer", "Computer Science", 2, StudentStatus.ACTIVE, 2);
        List<String> expected = List.of(a.getId(), b.getId()).stream().sorted().toList();
        mvc.perform(get("/api/students").param("sort", "name"))
                .andExpect(jsonPath("$.content[0].id").value(expected.get(0)))
                .andExpect(jsonPath("$.content[1].id").value(expected.get(1)));
    }

    @Test
    void dashboardUsesRealAggregation() throws Exception {
        seedFive();
        mvc.perform(get("/api/dashboard/stats")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalStudents").value(5))
                .andExpect(jsonPath("$.activeStudents").value(3))
                .andExpect(jsonPath("$.inactiveStudents").value(1))
                .andExpect(jsonPath("$.graduatedStudents").value(1))
                .andExpect(jsonPath("$.byCourse[?(@.course=='Computer Science')].count").value(4));
    }

    @Test
    void emptyDashboardReturnsZeros() throws Exception {
        mvc.perform(get("/api/dashboard/stats")).andExpect(jsonPath("$.totalStudents").value(0))
                .andExpect(jsonPath("$.byCourse", empty()));
    }

    @Test
    void expectedIndexesExistAndSelectiveQueriesUseIndexes() throws Exception {
        seedFive();
        var names = mongo.indexOps(Student.class).getIndexInfo().stream().map(i -> i.getName()).toList();
        assertThat(names).contains("uq_students_email", "uq_students_code", "idx_course_status_year_created",
                "idx_status_created", "idx_created", "idx_name", "idx_year_created", "txt_students_search");
        String emailPlan = mongo.getCollection("students").find(new Document("email", "it-001@example.edu"))
                .explain().toJson();
        assertThat(emailPlan).contains("IXSCAN").doesNotContain("COLLSCAN");
        String filterPlan = mongo.getCollection("students").find(new Document("course", "Computer Science")
                .append("status", "ACTIVE").append("yearLevel", 2))
                .sort(new Document("createdAt", -1).append("_id", 1)).limit(2).explain().toJson();
        assertThat(filterPlan).contains("idx_course_status_year_created").doesNotContain("COLLSCAN");
    }

    @Test
    void requestBoundsAndInvalidEnumsReturn400() throws Exception {
        mvc.perform(get("/api/students").param("size", "101")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/students").param("page", "-1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/students").param("page", "10001")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/students").param("sort", "unknown")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/students").param("status", "UNKNOWN")).andExpect(status().isBadRequest());
    }

    @Test
    void healthEndpointReportsDatabaseReadiness() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
