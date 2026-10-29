package com.example.students.config;

import com.example.students.model.Student;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.TextIndexDefinition;
import org.springframework.stereotype.Component;

/** Development convenience. Production uses database/indexes.js as a migration. */
@Component
@Order(1)
public class MongoIndexInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(MongoIndexInitializer.class);
    private final MongoTemplate mongo;
    private final boolean enabled;

    public MongoIndexInitializer(MongoTemplate mongo, @Value("${app.indexes.auto-create}") boolean enabled) {
        this.mongo = mongo;
        this.enabled = enabled;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.info("Automatic index creation disabled; apply database/indexes.js before serving traffic.");
            return;
        }
        var indexes = mongo.indexOps(Student.class);
        indexes.createIndex(new Index().on("email", Direction.ASC).unique().named("uq_students_email"));
        indexes.createIndex(new Index().on("studentCode", Direction.ASC).unique().named("uq_students_code"));
        indexes.createIndex(new Index().on("course", Direction.ASC).on("status", Direction.ASC)
                .on("yearLevel", Direction.ASC).on("createdAt", Direction.DESC).on("id", Direction.ASC)
                .named("idx_course_status_year_created"));
        indexes.createIndex(new Index().on("status", Direction.ASC).on("createdAt", Direction.DESC)
                .on("id", Direction.ASC).named("idx_status_created"));
        indexes.createIndex(new Index().on("createdAt", Direction.DESC).on("id", Direction.ASC)
                .named("idx_created"));
        indexes.createIndex(new Index().on("lastName", Direction.ASC).on("firstName", Direction.ASC)
                .on("id", Direction.ASC).named("idx_name"));
        indexes.createIndex(new Index().on("yearLevel", Direction.ASC).on("createdAt", Direction.DESC)
                .on("id", Direction.ASC).named("idx_year_created"));
        indexes.createIndex(TextIndexDefinition.builder()
                .onField("studentCode", 10f).onField("lastName", 8f).onField("firstName", 6f)
                .onField("email", 5f).onField("course", 2f)
                .withDefaultLanguage("none").named("txt_students_search").build());
        log.info("Student indexes are ready.");
    }
}
