import { pgTable, text, serial, integer, boolean, timestamp, foreignKey, json, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  groupName: text("group_name").notNull(),
  email: text("email").notNull(),
  isCoordinator: boolean("is_coordinator").default(false),
  isAdmin: boolean("is_admin").default(false),
  isUserAdmin: boolean("is_user_admin").default(false),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

// Product model
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: doublePrecision("price").notNull(),
  category: text("category").notNull(),
  available: boolean("available").default(true),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

// Order model
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"),
  total: doublePrecision("total").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  orderDate: timestamp("order_date").notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

// Order items model
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: doublePrecision("price").notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

// Available groups model
export const availableGroups = pgTable("available_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const insertAvailableGroupSchema = createInsertSchema(availableGroups).omit({
  id: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type AvailableGroup = typeof availableGroups.$inferSelect;
export type InsertAvailableGroup = z.infer<typeof insertAvailableGroupSchema>;

// Product category enum - Generic categories for various use cases
export const ProductCategories = {
  ALL: "All",
  FOOD: "Food",
  BEVERAGES: "Beverages",
  SNACKS: "Snacks",
  SUPPLIES: "Supplies",
  OTHER: "Other",
} as const;

export type ProductCategory = typeof ProductCategories[keyof typeof ProductCategories];

// Order status enum
export const OrderStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type OrderStatusType = typeof OrderStatus[keyof typeof OrderStatus];

// Cart item type
export type CartItem = {
  product: Product;
  quantity: number;
};
