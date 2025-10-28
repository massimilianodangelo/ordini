import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertOrderSchema, insertOrderItemSchema, insertProductSchema, insertUserSchema, CartItem, InsertUser } from "@shared/schema";
import { z } from "zod";
import { createHash } from "crypto";

async function ensureDefaultAdmin() {
  try {
    const existingAdmin = await storage.getUserByUsername("admin@grouporder.com");
    if (!existingAdmin) {
      console.log("Creating default admin account...");
      const salt = "c0ffee12deadbeef34abcd5678";
      const hashedPassword = createHash('sha256').update("admin123" + salt).digest('hex');
      
      await storage.createUser({
        username: "admin@grouporder.com",
        email: "admin@grouporder.com",
        password: `${hashedPassword}.${salt}`,
        firstName: "System",
        lastName: "Administrator",
        groupName: "Admin",
        isCoordinator: true,
        isAdmin: true,
        isUserAdmin: true
      });
      console.log("Default admin account created successfully");
    }
  } catch (error) {
    console.error("Error creating default admin:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Check if we're in demo mode
  const isDemoMode = process.env.DEMO_MODE === "true";
  
  // Health check endpoint per Render
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Setup authentication routes
  setupAuth(app);
  
  // Ensure default admin exists
  await ensureDefaultAdmin();
  
  // Rotte per la gestione dei gruppi
  app.get("/api/admin/groups", async (req, res) => {
    try {
      const groups = await storage.getAvailableGroups();
      res.json(groups);
    } catch (error) {
      console.error("Errore nel recupero dei gruppi:", error);
      res.status(500).json({ error: "Errore nel recupero dei gruppi" });
    }
  });
  
  app.post("/api/admin/groups", async (req, res) => {
    try {
      // Check demo mode
      if (isDemoMode) {
        return res.status(403).json({ message: "Group management is disabled in demo mode" });
      }
      
      // Verifica se l'utente è autenticato e ha i permessi di amministrazione utenti
      if (req.isAuthenticated() && !req.user?.isUserAdmin) {
        return res.status(403).json({ error: "Non autorizzato" });
      }
      
      const { groups } = req.body;
      
      if (!Array.isArray(groups)) {
        return res.status(400).json({ error: "Formato non valido" });
      }
      
      // Aggiorna i gruppi
      const updatedGroups = await storage.updateAvailableGroups(groups);
      
      res.json(updatedGroups);
    } catch (error) {
      console.error("Errore nell'aggiornamento dei gruppi:", error);
      res.status(500).json({ error: "Errore nell'aggiornamento dei gruppi" });
    }
  });

  // Products routes
  app.get("/api/products", async (req, res) => {
    try {
      const category = req.query.category as string;
      let products;
      
      if (category && category !== "All") {
        products = await storage.getProductsByCategory(category);
      } else {
        products = await storage.getProducts();
      }
      
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      // Verifica dell'autenticazione disabilitata per lo sviluppo
      /*
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Solo l'amministratore può aggiungere prodotti
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      */
      
      // Log per debug
      console.log("POST /api/products - Authentication status:", req.isAuthenticated(), "- User:", req.user);
      
      // Validare i dati del prodotto
      const productData = {
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        category: req.body.category,
        available: req.body.available !== undefined ? req.body.available : true
      };
      
      const validatedProductData = insertProductSchema.parse(productData);
      
      // Creare il prodotto
      const product = await storage.createProduct(validatedProductData);
      
      res.status(200).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid product data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create product" });
      }
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Solo l'amministratore può eliminare prodotti
      if (!req.user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const id = parseInt(req.params.id);
      
      // Elimina il prodotto
      const result = await storage.deleteProduct(id);
      
      if (!result) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Orders routes
  app.get("/api/orders", async (req, res) => {
    try {
      // Verifica autenticazione disabilitata per lo sviluppo
      /*
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      */

      // Stampa di debug per vedere lo stato dell'autenticazione
      console.log("GET /api/orders - Authentication status:", req.isAuthenticated(), "User:", req.user?.id);

      const userId = req.user?.id || (req.query.userId ? parseInt(req.query.userId as string) : undefined);
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      const orders = await storage.getOrdersByUser(userId);
      
      // For each order, get the order items with product details
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          
          // Get product details for each order item
          const itemsWithProducts = await Promise.all(
            items.map(async (item) => {
              const product = await storage.getProduct(item.productId);
              return {
                ...item,
                product
              };
            })
          );
          
          return {
            ...order,
            items: itemsWithProducts,
          };
        })
      );
      
      res.json(ordersWithItems);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      // In modalità sviluppo, consentiamo la creazione degli ordini senza autenticazione
      // per risolvere i problemi di gestione delle sessioni
      /*
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      */

      const userId = req.user?.id || req.body.userId;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // Validate the order data
      const orderData = {
        userId,
        total: req.body.total,
        status: "pending",
        orderDate: new Date(req.body.orderDate || new Date())
      };

      const validatedOrderData = insertOrderSchema.parse(orderData);
      
      // Create the order
      const order = await storage.createOrder(validatedOrderData);
      
      // Validate cart items and create order items
      const cartItemsSchema = z.array(z.object({
        product: z.object({
          id: z.number(),
          price: z.number()
        }),
        quantity: z.number().min(1)
      }));
      
      const validatedCartItems = cartItemsSchema.parse(req.body.items);
      
      // Create order items
      await Promise.all(
        validatedCartItems.map(async (item) => {
          const orderItemData = {
            orderId: order.id,
            productId: item.product.id,
            quantity: item.quantity,
            price: item.product.price
          };
          
          await storage.createOrderItem(orderItemData);
        })
      );
      
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid order data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create order" });
      }
    }
  });

  // Admin routes
  app.get("/api/admin/orders", async (req, res) => {
    try {
      // Verifica dell'autenticazione disabilitata per lo sviluppo
      /*
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user is a coordinator or admin
      if (!req.user?.isCoordinator && !req.user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      */
      
      // Log per debug
      console.log("GET /api/admin/orders - Authentication status:", req.isAuthenticated(), "- User:", req.user);

      // Per l'amministratore, otteniamo TUTTI gli ordini invece di filtrare per data
      const allOrders = await storage.getOrders();
      console.log(`Ottenuti ${allOrders.length} ordini totali per l'amministratore`);
      
      // For each order, get the order items and user info
      const ordersWithDetails = await Promise.all(
        allOrders.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          const user = await storage.getUser(order.userId);
          
          // Get product details for each order item
          const itemsWithProducts = await Promise.all(
            items.map(async (item) => {
              const product = await storage.getProduct(item.productId);
              return {
                ...item,
                product
              };
            })
          );
          
          return {
            ...order,
            items: itemsWithProducts,
            user: user ? {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              groupName: user.groupName
            } : {
              id: 0,
              firstName: "Utente",
              lastName: "Sconosciuto",
              groupName: "N/A"
            }
          };
        })
      );
      
      console.log(`Inviati ${ordersWithDetails.length} ordini completi all'amministratore`);
      res.json(ordersWithDetails);
    } catch (error) {
      console.error("Error fetching admin orders:", error);
      res.status(500).json({ message: "Failed to fetch admin orders" });
    }
  });
  
  // Ottieni ordini per gruppo (solo per coordinatori di gruppo)
  app.get("/api/admin/orders/group/:groupname", async (req, res) => {
    try {
      // Log per debug
      console.log("GET /api/admin/orders/group/:groupname - Authentication status:", req.isAuthenticated(), "- User:", req.user, "- Group:", req.params.groupname);
      
      // Riceviamo il parametro del gruppo e lo decodifichiamo
      const groupName = decodeURIComponent(req.params.groupname);
      console.log("Gruppo decodificato:", groupName);
      
      if (!groupName) {
        return res.status(400).json({ message: "Group parameter is required" });
      }
      
      // Otteniamo tutti gli ordini per quel gruppo
      const orders = await storage.getOrdersByGroup(groupName);
      console.log(`Ottenuti ${orders.length} ordini per il gruppo ${groupName}`);
      
      // Aggiunge i dettagli degli item e utente all'ordine
      const ordersWithDetails = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          const user = await storage.getUser(order.userId);
          
          // Get product details for each order item
          const itemsWithProducts = await Promise.all(
            items.map(async (item) => {
              const product = await storage.getProduct(item.productId);
              return {
                ...item,
                product
              };
            })
          );
          
          return { 
            ...order, 
            items: itemsWithProducts,
            user: user ? {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              groupName: user.groupName
            } : null
          };
        })
      );
      
      console.log(`Inviati ${ordersWithDetails.length} ordini completi per il gruppo ${groupName}`);
      res.json(ordersWithDetails);
    } catch (error) {
      console.error("Error fetching group orders:", error);
      res.status(500).json({ message: "Failed to fetch group orders" });
    }
  });

  app.patch("/api/admin/orders/:id/status", async (req, res) => {
    try {
      // Verifica dell'autenticazione disabilitata per lo sviluppo
      /*
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user is a coordinator or admin
      if (!req.user?.isCoordinator && !req.user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      */
      
      // Log per debug
      console.log("PATCH /api/admin/orders/:id/status - Authentication status:", req.isAuthenticated(), "- User:", req.user, "- Order ID:", req.params.id, "- Status:", req.body.status);

      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      // Update the order status
      const updatedOrder = await storage.updateOrderStatus(id, status);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // User management routes (solo per admin utenti)
  app.get("/api/admin/users", async (req, res) => {
    try {
      console.log("GET /api/admin/users - Authentication status:", req.isAuthenticated());
      // In modalità sviluppo, consentiamo l'accesso alla gestione utenti senza autenticazione
      // per risolvere i problemi di gestione delle sessioni
      /*
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log("GET /api/admin/users - User:", req.user);
      // Check if user is a user admin
      if (!req.user?.isUserAdmin) {
        console.log("GET /api/admin/users - Access denied, user is not an admin:", req.user?.username);
        return res.status(403).json({ message: "Forbidden" });
      }
      */

      const users = await storage.getAllUsers();
      
      // Rimuovi le password prima di inviare i dati
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", async (req, res) => {
    try {
      // Check demo mode
      if (isDemoMode) {
        return res.status(403).json({ message: "User management is disabled in demo mode" });
      }
      
      // In modalità sviluppo, consentiamo l'accesso alla gestione utenti senza autenticazione
      // per risolvere i problemi di gestione delle sessioni
      /*
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user is a user admin
      if (!req.user?.isUserAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      */
      
      // Validare i dati dell'utente
      const userData = {
        username: req.body.username,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        groupName: req.body.groupName,
        email: req.body.email || req.body.username, // Se email non viene fornita, usa username
        isCoordinator: req.body.isCoordinator,
        isAdmin: req.body.isAdmin,
        isUserAdmin: req.body.isUserAdmin
      };
      
      const validatedUserData = insertUserSchema.parse(userData);
      
      // Controlla se l'utente esiste già
      const existingUser = await storage.getUserByUsername(validatedUserData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash della password prima di salvarla
      const crypto = await import('crypto');
      const salt = crypto.randomBytes(16).toString('hex');
      const scrypt = crypto.scryptSync;
      const hashedPassword = crypto.scryptSync(validatedUserData.password, salt, 64).toString('hex') + '.' + salt;
      
      // Creare l'utente con la password hashata
      const userToCreate = {
        ...validatedUserData,
        password: hashedPassword
      };
      
      const user = await storage.createUser(userToCreate);
      
      // Rimuovi la password prima di inviare i dati
      const { password, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid user data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create user" });
      }
    }
  });

  app.patch("/api/admin/users/:id", async (req, res) => {
    try {
      // Check demo mode
      if (isDemoMode) {
        return res.status(403).json({ message: "User management is disabled in demo mode" });
      }
      
      // In modalità sviluppo, consentiamo l'accesso alla gestione utenti senza autenticazione
      // per risolvere i problemi di gestione delle sessioni
      /*
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user is a user admin
      if (!req.user?.isUserAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      */
      
      const id = parseInt(req.params.id);
      
      // Ottieni l'utente esistente
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Raccogli i dati da aggiornare
      const updateData: Partial<InsertUser> = {};
      
      if (req.body.password) {
        // Hash della password prima di salvarla
        const crypto = await import('crypto');
        const salt = crypto.randomBytes(16).toString('hex');
        const hashedPassword = crypto.scryptSync(req.body.password, salt, 64).toString('hex') + '.' + salt;
        updateData.password = hashedPassword;
      }
      
      if (req.body.firstName) updateData.firstName = req.body.firstName;
      if (req.body.lastName) updateData.lastName = req.body.lastName;
      if (req.body.groupName) updateData.groupName = req.body.groupName;
      if (req.body.email) updateData.email = req.body.email;
      if (req.body.isCoordinator !== undefined) updateData.isCoordinator = req.body.isCoordinator;
      if (req.body.isAdmin !== undefined) updateData.isAdmin = req.body.isAdmin;
      if (req.body.isUserAdmin !== undefined) updateData.isUserAdmin = req.body.isUserAdmin;
      
      // Aggiorna l'utente
      const updatedUser = await storage.updateUser(id, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Rimuovi la password prima di inviare i dati
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  
  // Endpoint per eliminare un utente
  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      // Check demo mode
      if (isDemoMode) {
        return res.status(403).json({ message: "User management is disabled in demo mode" });
      }
      
      // In modalità sviluppo, consentiamo l'accesso alla gestione utenti senza autenticazione
      // per risolvere i problemi di gestione delle sessioni
      /*
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user is a user admin
      if (!req.user?.isUserAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      */
      
      const id = parseInt(req.params.id);
      
      // Verifica che l'utente esista
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Elimina l'utente
      const deleted = await storage.deleteUser(id);
      
      if (!deleted) {
        return res.status(400).json({ message: "Failed to delete user" });
      }
      
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Endpoint per eliminare tutti gli utenti (inclusi admin, senza eccezioni)
  app.delete("/api/admin/users/students/all", async (req, res) => {
    try {
      // Check demo mode
      if (isDemoMode) {
        return res.status(403).json({ message: "User management is disabled in demo mode" });
      }
      
      // Controllo sicurezza
      /*
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Controlla se l'utente è un amministratore di utenti
      if (!req.user?.isUserAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      */
      
      // Ottieni tutti gli utenti
      const allUsers = await storage.getAllUsers();
      
      // Filter only regular users and coordinators
      // Exclude admin users (isAdmin) and user admins (isUserAdmin)
      const usersToDelete = allUsers.filter(user => !user.isAdmin && !user.isUserAdmin);
      
      console.log(`Deleting ${usersToDelete.length} users (excluding admins)`);
      
      let deletedCount = 0;
      
      // Elimina ogni utente
      for (const user of usersToDelete) {
        const success = await storage.deleteUser(user.id);
        if (success) {
          deletedCount++;
        }
      }
      
      res.status(200).json({ 
        message: `${deletedCount} users deleted successfully`,
        count: deletedCount 
      });
    } catch (error) {
      console.error("Error deleting users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Endpoint to promote members to next group
  app.post("/api/admin/users/promote", async (req, res) => {
    try {
      // Security check
      /*
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user is a user admin
      if (!req.user?.isUserAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      */
      
      console.log("POST /api/admin/users/promote - Member promotion started");
      
      // Execute member promotion
      const result = await storage.promoteMembers();
      
      console.log(`Promotion completed: ${result.updated} members updated`);
      console.log("Groups updated:", result.groups);
      
      res.status(200).json({ 
        message: `Successfully promoted ${result.updated} members`, 
        updatedCount: result.updated,
        groupChanges: result.groups 
      });
    } catch (error) {
      console.error("Error promoting members:", error);
      res.status(500).json({ message: "Error during member promotion" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}
