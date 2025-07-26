-- Création de la table users
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at DATE DEFAULT CURRENT_DATE
);

-- Création de la table orders
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  product TEXT NOT NULL,
  price REAL,
  created_at DATE DEFAULT CURRENT_DATE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Insertion de données dans users
INSERT INTO users (name, email, created_at) VALUES
('Alice', 'alice@mail.com', '2025-07-01'),
('Bob', 'bob@mail.com', '2025-07-10'),
('Charlie', 'charlie@mail.com', '2025-07-14');

-- Insertion de données dans orders
INSERT INTO orders (user_id, product, price, created_at) VALUES
(1, 'Livre', 19.99, '2025-07-02'),
(2, 'Stylo', 2.49, '2025-07-11'),
(3, 'Clavier', 45.00, '2025-07-15'),
(1, 'Cahier', 3.75, '2025-07-05');
