package com.example.students.service;

import com.example.students.dto.StudentRequest;
import com.example.students.exception.BadRequestException;
import com.example.students.exception.NotFoundException;
import com.example.students.model.Student;
import com.example.students.model.StudentStatus;
import com.example.students.repository.StudentRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Query;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StudentServiceTest {
    @Mock StudentRepository repository;
    @Mock MongoTemplate mongo;
    @InjectMocks StudentService service;

    static StudentRequest request() {
        return new StudentRequest("stu-2026-001", " Ananya ", " Iyer ", " ANANYA@Example.EDU ",
                " Computer Science ", 2, StudentStatus.ACTIVE);
    }
    static Student student() {
        Student s = new Student();
        s.setId("507f1f77bcf86cd799439011");
        s.setStudentCode("STU-2026-001"); s.setFirstName("Ananya"); s.setLastName("Iyer");
        s.setEmail("ananya@example.edu"); s.setCourse("Computer Science"); s.setYearLevel(2);
        s.setStatus(StudentStatus.ACTIVE); s.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        s.setUpdatedAt(s.getCreatedAt());
        return s;
    }

    @Test
    void createNormalizesFieldsAndOwnsTimestamps() {
        when(repository.insert(any(Student.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var response = service.create(request());
        var captor = ArgumentCaptor.forClass(Student.class);
        verify(repository).insert(captor.capture());
        assertThat(captor.getValue().getStudentCode()).isEqualTo("STU-2026-001");
        assertThat(captor.getValue().getEmail()).isEqualTo("ananya@example.edu");
        assertThat(captor.getValue().getFirstName()).isEqualTo("Ananya");
        assertThat(captor.getValue().getCourse()).isEqualTo("Computer Science");
        assertThat(captor.getValue().getCreatedAt()).isEqualTo(captor.getValue().getUpdatedAt());
        assertThat(response.status()).isEqualTo(StudentStatus.ACTIVE);
    }

    @Test
    void updatePreservesIdentityAndCreationTime() {
        Student existing = student();
        when(repository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(mongo.findAndReplace(any(Query.class), eq(existing), any(org.springframework.data.mongodb.core.FindAndReplaceOptions.class))).thenReturn(existing);
        service.update(existing.getId(), request());
        assertThat(existing.getCreatedAt()).isEqualTo(Instant.parse("2026-01-01T00:00:00Z"));
        assertThat(existing.getUpdatedAt()).isAfter(existing.getCreatedAt());
        assertThat(existing.getId()).isEqualTo("507f1f77bcf86cd799439011");
    }

    @Test
    void updateDoesNotInsertWhenDocumentWasDeleted() {
        Student existing = student();
        when(repository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(mongo.findAndReplace(any(Query.class), eq(existing), any(org.springframework.data.mongodb.core.FindAndReplaceOptions.class))).thenReturn(null);
        assertThatThrownBy(() -> service.update(existing.getId(), request())).isInstanceOf(NotFoundException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void invalidIdsReturnNotFoundInsteadOfCastErrors() {
        assertThatThrownBy(() -> service.get("not-an-object-id")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.delete("not-an-object-id")).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(repository, mongo);
    }

    @Test
    void deleteMissingDocumentReturnsNotFound() {
        when(mongo.findAndRemove(any(Query.class), eq(Student.class))).thenReturn(null);
        assertThatThrownBy(() -> service.delete("507f1f77bcf86cd799439011")).isInstanceOf(NotFoundException.class);
    }

    @ParameterizedTest
    @CsvSource({"-1,10,2", "0,0,2", "0,101,2", "10001,10,2", "0,10,0"})
    void rejectsInvalidPaginationAndYear(int page, int size, int year) {
        assertThatThrownBy(() -> service.list(null, null, null, year, page, size, "newest"))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(mongo);
    }

    @Test
    void rejectsUnknownSortAndOversizedSearch() {
        assertThatThrownBy(() -> service.list(null, null, null, null, 0, 10, "password"))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.list("x".repeat(101), null, null, null, 0, 10, "newest"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void listUsesLiteralTextOperatorAndBoundedPage() {
        when(mongo.count(any(Query.class), eq(Student.class))).thenReturn(1L);
        when(mongo.find(any(Query.class), eq(Student.class))).thenReturn(List.of(student()));
        var page = service.list("Sharma", "Computer Science", StudentStatus.ACTIVE, 2, 0, 10, "newest");
        var captor = ArgumentCaptor.forClass(Query.class);
        verify(mongo).find(captor.capture(), eq(Student.class));
        Document query = captor.getValue().getQueryObject();
        assertThat(query.toJson()).contains("$text", "$search", "Sharma", "Computer Science");
        assertThat(captor.getValue().getLimit()).isEqualTo(10);
        assertThat(page.totalPages()).isEqualTo(1);
        assertThat(page.last()).isTrue();
    }

    @Test
    void emptyStatisticsAreZeroRatherThanNull() {
        when(mongo.getCollectionName(Student.class)).thenReturn("students");
        when(mongo.aggregate(any(org.springframework.data.mongodb.core.aggregation.Aggregation.class), eq("students"), eq(Document.class)))
                .thenReturn(new AggregationResults<>(List.of(), new Document()));
        var stats = service.statistics();
        assertThat(stats.totalStudents()).isZero();
        assertThat(stats.byCourse()).isEmpty();
    }
}
