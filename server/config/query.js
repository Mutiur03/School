import pool from "./db.js";
export const getQuery = async (query) => await pool.query(query);
const runQuery = async () => {
  await pool.query(`
    create table if not exists admin(
    id serial primary key,
    username varchar(50),
    password varchar(50),
    role char(5) default 'admin'
    )
  `);
  
  await pool.query(` 
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        login_id INT UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        father_name VARCHAR(100),
        mother_name VARCHAR(100),
        phone CHAR(11),
        parent_phone CHAR(11),
        batch CHAR(4) NOT NULL,
        address TEXT,
        dob VARCHAR(10),
        UNIQUE (login_id, phone),
        blood_group VARCHAR(10),
        has_stipend boolean DEFAULT FALSE, 
        image TEXT,
        password VARCHAR(100),
        available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP )  
    `);
  await pool.query(`
      CREATE TABLE IF NOT EXISTS student_enrollments (
        id SERIAL PRIMARY KEY, 
        student_id INT REFERENCES students(id) ON DELETE CASCADE,
        class INT NOT NULL,
        roll INT NOT NULL,
        section CHAR(1) NOT NULL,
        year INT NOT NULL,
        department VARCHAR(100),  
        fail_count INT DEFAULT 0,
        status VARCHAR(100) DEFAULT 'Passed',
        final_merit INT DEFAULT 0,
        next_year_roll INT DEFAULT 0,
        next_year_section CHAR(1) DEFAULT null,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, class, year)  
      )
    `);
  await pool.query(
    "CREATE TABLE IF NOT EXISTS attendence (id SERIAL PRIMARY KEY, student_id INT REFERENCES students(id)  ON DELETE CASCADE, date VARCHAR(10), status VARCHAR(255), send_msg BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
  );
  await pool.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id SERIAL PRIMARY KEY,
        exam_name VARCHAR(100) NOT NULL,
        exam_year INT NOT NULL,
        levels INT[] NOT NULL,
        start_date VARCHAR(10) NOT NULL,
        end_date VARCHAR(10) NOT NULL,
        result_date VARCHAR(10) NOT NULL,
        visible BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (exam_name, exam_year, levels)
      )`);
  await pool.query(
    "CREATE TABLE IF NOT EXISTS holidays (id SERIAL PRIMARY KEY, title VARCHAR(255), start_date VARCHAR(10), end_date VARCHAR(10), description TEXT, is_optional BOOLEAN)"
  );

  await pool.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        phone CHAR(11) NOT NULL,
        subject VARCHAR(100),
        academic_qualification TEXT,
        designation VARCHAR(100),
        password VARCHAR(255) NOT NULL,
        image TEXT,
        address TEXT,
        dob VARCHAR(10),
        blood_group VARCHAR(10),
        available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) 
    `);

  await pool.query(
    `CREATE TABLE IF NOT EXISTS levels (
        id SERIAL PRIMARY KEY,
        class_name INT NOT NULL,
        section CHAR(1) NOT NULL,
        year INT NOT NULL,
        teacher_id INT NOT NULL,
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE)`
  );
  await pool.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        class INT NOT NULL,
        full_mark INT NOT NULL,
        pass_mark INT NOT NULL,
        year INT DEFAULT ${new Date().getFullYear()},
        teacher_id INT REFERENCES teachers(id) ON DELETE CASCADE,
        department VARCHAR(100) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (name, class, department, year)
      )
    `);
  await pool.query(`
      CREATE TABLE IF NOT EXISTS marks (
        id SERIAL PRIMARY KEY,
        enrollment_id INT NOT NULL REFERENCES student_enrollments(id) ON DELETE CASCADE,
        subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        marks INT NOT NULL DEFAULT 0 CHECK (marks >= 0 AND marks <= 100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_marks_entry UNIQUE (enrollment_id, subject_id, exam_id)
      );
    `);
  await pool.query(`
      CREATE TABLE IF NOT EXISTS gpa (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE, 
        jsc_gpa FLOAT DEFAULT 0 CHECK (jsc_gpa >= 0 AND jsc_gpa <= 5),
        ssc_gpa FLOAT DEFAULT 0 CHECK (ssc_gpa >= 0 AND ssc_gpa <= 5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unique (student_id)
    )`);
  const result = await pool.query(
    "SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories'"
  );
  if (result.rows.length === 0) {
    await pool.query(` 
        CREATE TABLE categories (
            id SERIAL PRIMARY KEY,
            category VARCHAR(255),
            thumbnail TEXT
        );
      `);
    await pool.query(`
        INSERT INTO categories (category) VALUES
        ('Event'),
        ('Campus'),
        ('Labs');
      `);
  }
  await pool.query(
    "CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, title VARCHAR(255), details TEXT, date VARCHAR(10),image TEXT, file TEXT, category VARCHAR(255) default 'Event', location VARCHAR(255), thumbnail TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
  );
  await pool.query(
    "CREATE TABLE IF NOT EXISTS gallery (id SERIAL PRIMARY KEY, event_id INTEGER REFERENCES events(id) ON DELETE CASCADE, category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE, image_path TEXT, caption TEXT, status VARCHAR(255) default 'pending', uploader_id INTEGER REFERENCES students(id) ON DELETE CASCADE, uploader_type VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS notices (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            details TEXT NOT NULL,
            file VARCHAR(255),
            download_url VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
  );
  console.log("Query executed successfully");
};
