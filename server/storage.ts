import { users, type User, type InsertUser, products, type Product, type InsertProduct, orders, type Order, type InsertOrder, orderItems, type OrderItem, type InsertOrderItem } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import fs from 'fs';
import path from 'path';

// Crea una directory di storage se non esiste
const storageDir = path.join(process.cwd(), 'storage');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir);
}

// File di storage per i dati persistenti
const dataFilePath = path.join(storageDir, 'app-data.json');

// Funzioni di utilità per la persistenza dati
const Storage = {
  // Salva i dati nel file
  saveData: (key: string, value: any): void => {
    try {
      let data: Record<string, any> = {};
      if (fs.existsSync(dataFilePath)) {
        const fileData = fs.readFileSync(dataFilePath, 'utf8');
        if (fileData) {
          data = JSON.parse(fileData);
        }
      }
      data[key] = value;
      fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Dati salvati con chiave: ${key}`);
    } catch (error) {
      console.error('Errore nel salvataggio dei dati:', error);
    }
  },

  // Carica i dati dal file
  loadData: (key: string): any => {
    try {
      if (fs.existsSync(dataFilePath)) {
        const fileData = fs.readFileSync(dataFilePath, 'utf8');
        if (fileData) {
          const data = JSON.parse(fileData);
          return data[key] || null;
        }
      }
    } catch (error) {
      console.error('Errore nel caricamento dei dati:', error);
    }
    return null;
  },

  // Elimina una chiave di dati
  removeData: (key: string): void => {
    try {
      if (fs.existsSync(dataFilePath)) {
        let data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
        if (data && data[key]) {
          delete data[key];
          fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
          console.log(`Dati rimossi con chiave: ${key}`);
        }
      }
    } catch (error) {
      console.error('Errore nella rimozione dei dati:', error);
    }
  },

  // Pulisce tutti i dati
  clearData: (): void => {
    try {
      fs.writeFileSync(dataFilePath, '{}', 'utf8');
      console.log('Tutti i dati sono stati rimossi');
    } catch (error) {
      console.error('Errore nella pulizia dei dati:', error);
    }
  }
};

// Fix per l'errore di tipo per SessionStore
type SessionStore = session.Store;
const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>; // Per ottenere tutti gli utenti
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>; // Per aggiornare i dati utente, inclusa la password
  deleteUser(id: number): Promise<boolean>; // Per eliminare un utente
  promoteMembers(): Promise<{ updated: number, groups: { from: string, to: string }[] }>; // Per promuovere i membri al gruppo successivo
  
  // Product operations
  getProducts(): Promise<Product[]>;
  getProductsByCategory(category: string): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  
  // Order operations
  getOrders(): Promise<Order[]>;
  getOrdersByUser(userId: number): Promise<Order[]>;
  getOrdersByDate(date: Date): Promise<Order[]>;
  getOrdersByGroup(groupName: string): Promise<Order[]>;
  getOrderById(id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  
  // Order items operations
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  
  // Group operations
  getAvailableGroups(): Promise<string[]>;
  updateAvailableGroups(groups: string[]): Promise<string[]>;
  
  // Session store
  sessionStore: SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private products: Map<number, Product>;
  private orders: Map<number, Order>;
  private orderItems: Map<number, OrderItem>;
  private availableGroups: string[];
  public sessionStore: SessionStore;
  
  private userId: number;
  private productId: number;
  private orderId: number;
  private orderItemId: number;
  private deletedUserIds: number[] = []; // Array per memorizzare gli ID degli utenti eliminati

  constructor() {
    // Carica i dati se esistono
    try {
      const savedData = Storage.loadData('appData');
      if (savedData) {
        this.users = new Map(savedData.users);
        this.products = new Map(savedData.products);
        this.orders = new Map(savedData.orders);
        this.orderItems = new Map(savedData.orderItems);
        this.userId = savedData.userId;
        this.productId = savedData.productId;
        this.orderId = savedData.orderId;
        this.orderItemId = savedData.orderItemId;
        // Carica gli ID utente eliminati e li ordina in modo crescente
        this.deletedUserIds = savedData.deletedUserIds || [];
        // Garantisce che gli ID siano sempre ordinati in modo crescente
        if (this.deletedUserIds.length > 0) {
          this.deletedUserIds.sort((a, b) => a - b);
        }
        console.log("Dati caricati dal file di storage");
      } else {
        // Inizializza nuovi dati se non esiste un salvataggio
        this.users = new Map();
        this.products = new Map();
        this.orders = new Map();
        this.orderItems = new Map();
        this.userId = 1;
        this.productId = 1;
        this.orderId = 1;
        this.orderItemId = 1;
        
        // Aggiungi l'utente amministratore predefinito
        this.createAdminUser();
        
        // Initialize with some sample products
        this.initializeProducts();
        console.log("Nuovi dati inizializzati");
      }
    } catch (error) {
      console.error("Errore nel caricamento dei dati:", error);
      // Fallback a un nuovo stato se c'è un errore
      this.users = new Map();
      this.products = new Map();
      this.orders = new Map();
      this.orderItems = new Map();
      this.userId = 1;
      this.productId = 1;
      this.orderId = 1;
      this.orderItemId = 1;
      
      // Aggiungi l'utente amministratore predefinito
      this.createAdminUser();
      
      // Initialize with some sample products
      this.initializeProducts();
    }
    
    // Prova a caricare i gruppi dal file separato
    try {
      const savedGroups = Storage.loadData('availableGroups');
      if (savedGroups) {
        this.availableGroups = savedGroups;
      } else {
        // Se non esiste, inizializza con un array vuoto
        this.availableGroups = [];
      }
    } catch (error) {
      console.error("Errore nel caricamento dei gruppi:", error);
      this.availableGroups = [];
    }
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
  }
  
  // Salva i dati nel file di storage
  private saveData() {
    try {
      const dataToSave = {
        users: Array.from(this.users.entries()),
        products: Array.from(this.products.entries()),
        orders: Array.from(this.orders.entries()),
        orderItems: Array.from(this.orderItems.entries()),
        userId: this.userId,
        productId: this.productId,
        orderId: this.orderId,
        orderItemId: this.orderItemId,
        deletedUserIds: this.deletedUserIds // Salva anche gli ID utente eliminati
      };
      Storage.saveData('appData', dataToSave);
    } catch (error) {
      console.error("Errore nel salvataggio dei dati:", error);
    }
  }

  // Initialize sample products
  private initializeProducts() {
    const sampleProducts: InsertProduct[] = [
      {
        name: "TRAMEZZINO TONNO E POMODORO",
        description: "Tramezzino con tonno e pomodoro",
        price: 2.00,
        category: "Tramezzini",
        available: true
      },
      {
        name: "TRAMEZZINO PROSCIUTTO COTTO",
        description: "Tramezzino con prosciutto cotto e formaggio edamer",
        price: 2.00,
        category: "Tramezzini",
        available: true
      },
      {
        name: "TRAMEZZINO PROSCIUTTO CRUDO",
        description: "Tramezzino con prosciutto crudo e formaggio edamer",
        price: 2.00,
        category: "Tramezzini",
        available: true
      },
      {
        name: "TRAMEZZINO SALAME",
        description: "Tramezzino con salame e formaggio edamer",
        price: 2.00,
        category: "Tramezzini",
        available: true
      },
      {
        name: "CALZONE AL FORNO",
        description: "Calzone al forno con prosciutto cotto e mozzarella",
        price: 2.00,
        category: "Calzoni",
        available: true
      },
      {
        name: "PANINO TONDO PROSCIUTTO CRUDO",
        description: "Panino tondo con prosciutto crudo",
        price: 2.50,
        category: "Panini",
        available: true
      },
      {
        name: "PANINO TONDO PETTO DI TACCHINO",
        description: "Panino tondo con petto di tacchino arrosto, rucola, grana e olio d'oliva",
        price: 2.50,
        category: "Panini",
        available: true
      },
      {
        name: "PANINO TONDO PROSCIUTTO COTTO",
        description: "Panino tondo con prosciutto cotto",
        price: 2.50,
        category: "Panini",
        available: true
      },
      {
        name: "PANINO TONDO SALAME",
        description: "Panino tondo con salame",
        price: 2.50,
        category: "Panini",
        available: true
      },
      {
        name: "PANINO TONDO HAMBURGER",
        description: "Panino tondo con hamburger di manzo, lattuga e pomodoro",
        price: 2.50,
        category: "Panini",
        available: true
      },
      {
        name: "PIZZA BIANCA SEMPLICE",
        description: "Pizza bianca semplice",
        price: 1.00,
        category: "Pizze",
        available: true
      },
      {
        name: "PIZZA ROSSA SEMPLICE",
        description: "Pizza rossa con pomodoro",
        price: 1.50,
        category: "Pizze",
        available: true
      },
      {
        name: "PIZZA PATATE",
        description: "Pizza con patate",
        price: 1.50,
        category: "Pizze",
        available: true
      }
    ];

    sampleProducts.forEach(product => {
      this.createProduct(product);
    });
  }

  // Crea gli utenti amministratori predefiniti
  private async createAdminUser() {
    // Verifica se l'utente amministratore principale esiste già
    const existingAdmin = await this.getUserByUsername("prova@amministratore.it");
    if (!existingAdmin) {
      // Genera l'hash della password usando una funzione sincrona
      const salt = "c0ffee12deadbeef34abcd5678";
      const password = "Prova2025!";
      // Usa il modulo crypto importato in modo corretto
      const crypto = await import('crypto');
      const hashedPassword = crypto.createHash('sha256').update(password + salt).digest('hex') + "." + salt;
      
      const adminUser: InsertUser = {
        username: "prova@amministratore.it",
        password: hashedPassword, // Password con hash
        firstName: "Admin",
        lastName: "System",
        groupName: "Admin",
        email: "prova@amministratore.it",
        isAdmin: true,
        isCoordinator: false
      };
      
      const user = await this.createUser(adminUser);
      console.log("Utente amministratore principale creato:", user.username);
    } else {
      console.log("Utente amministratore principale già esistente:", existingAdmin.username);
    }
    
    // Verifica se l'utente amministratore per la gestione utenti esiste già
    const existingUserAdmin = await this.getUserByUsername("gestione@amministratore.it");
    if (!existingUserAdmin) {
      // Genera l'hash della password
      const salt = "f1b2c3d4e5f6789abcdef123";
      const password = "Gestione2025!";
      const crypto = await import('crypto');
      const hashedPassword = crypto.createHash('sha256').update(password + salt).digest('hex') + "." + salt;
      
      const userAdminUser: InsertUser = {
        username: "gestione@amministratore.it",
        password: hashedPassword,
        firstName: "Gestione",
        lastName: "Utenti",
        groupName: "Admin",
        email: "gestione@amministratore.it",
        isAdmin: false, // Non è un amministratore generale
        isCoordinator: false,
        isUserAdmin: true // Flag per identificare gli admin di gestione utenti
      };
      
      const user = await this.createUser(userAdminUser);
      console.log("Utente amministratore per gestione utenti creato:", user.username);
    } else {
      console.log("Utente amministratore per gestione utenti già esistente:", existingUserAdmin.username);
    }
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      return undefined;
    }
    
    const updatedUser = { ...existingUser, ...userData };
    this.users.set(id, updatedUser);
    this.saveData(); // Salva dopo l'aggiornamento dell'utente
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      console.log(`deleteUser: Utente con ID ${id} non trovato`);
      return false;
    }
    
    console.log(`deleteUser: Eliminazione utente con ID ${id} (${existingUser.firstName} ${existingUser.lastName})`);
    
    // Elimina gli ordini collegati all'utente
    const userOrders = Array.from(this.orders.values()).filter(order => order.userId === id);
    for (const order of userOrders) {
      // Elimina gli elementi dell'ordine
      const orderItems = Array.from(this.orderItems.values()).filter(item => item.orderId === order.id);
      for (const item of orderItems) {
        this.orderItems.delete(item.id);
      }
      // Elimina l'ordine
      this.orders.delete(order.id);
    }
    
    // Elimina l'utente
    this.users.delete(id);
    
    // Aggiungi l'ID alla lista di ID eliminati per il riutilizzo futuro
    if (!this.deletedUserIds.includes(id)) {
      console.log(`deleteUser: Aggiunto ID ${id} all'array deletedUserIds`);
      this.deletedUserIds.push(id);
    } else {
      console.log(`deleteUser: ID ${id} già presente nell'array deletedUserIds`);
    }
    
    // Ordina gli ID eliminati in ordine crescente per garantire che venga sempre riutilizzato il più piccolo
    this.deletedUserIds.sort((a, b) => a - b);
    
    console.log(`deleteUser: Array deletedUserIds aggiornato: [${this.deletedUserIds.join(', ')}]`);
    
    this.saveData(); // Salva dopo l'eliminazione dell'utente
    
    return true;
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    // Determina l'ID da usare per il nuovo utente
    let id: number;
    
    // Carica sempre gli ultimi dati dal file di storage per assicurarsi di avere i dati più aggiornati
    const savedData = Storage.loadData('appData');
    if (savedData && savedData.deletedUserIds) {
      // Aggiorna l'array con gli ultimi dati salvati
      this.deletedUserIds = savedData.deletedUserIds;
      console.log(`createUser: Caricati ID eliminati: [${this.deletedUserIds.join(', ')}]`);
    }
    
    // Controlla se ci sono ID eliminati da riutilizzare (in ordine crescente)
    if (this.deletedUserIds.length > 0) {
      // Garantisce che gli ID eliminati siano sempre ordinati in modo crescente
      this.deletedUserIds.sort((a, b) => a - b);
      
      // Prende l'ID più piccolo disponibile tra quelli eliminati
      id = this.deletedUserIds.shift() as number;
      console.log(`createUser: Riutilizzo ID utente eliminato: ${id}`);
    } else {
      // Se non ci sono ID eliminati da riutilizzare, trova l'ID massimo attualmente in uso
      let maxId = 0;
      if (savedData && savedData.users) {
        // Ottiene tutti gli ID utente
        const userIds = savedData.users.map((userEntry: [number, User]) => userEntry[0]);
        
        // Trova l'ID massimo, se esistono utenti
        if (userIds.length > 0) {
          maxId = Math.max(...userIds);
          console.log(`createUser: ID utente massimo trovato: ${maxId}`);
        }
      } else {
        // Se non ci sono dati salvati, usiamo l'ID corrente 
        maxId = this.userId - 1;
        console.log(`createUser: Nessun utente esistente, ID massimo inizializzato a: ${maxId}`);
      }
      
      // Assegna ID sequenziale (massimo + 1)
      id = maxId + 1;
      console.log(`createUser: Assegnato nuovo ID utente sequenziale: ${id}`);
    }
    
    // Aggiorna userId solo se il nuovo ID è maggiore, per mantenere l'incremento corretto
    if (id >= this.userId) {
      this.userId = id + 1;
    }
    
    // Controlla se è un amministratore basato sull'email
    const isAdmin = insertUser.email === 'prova@amministratore.it' ||
                   !!insertUser.isAdmin;
    
    // Controlla se è un amministratore di gestione utenti
    const isUserAdmin = insertUser.email === 'gestione@amministratore.it' ||
                       !!insertUser.isUserAdmin;
    
    // Check if user is a group coordinator
    const isCoordinator = !!insertUser.isCoordinator;
    
    const user: User = { 
      ...insertUser, 
      id, 
      isCoordinator, 
      isAdmin,
      isUserAdmin: isUserAdmin
    };
    
    this.users.set(id, user);
    this.saveData(); // Salva i dati dopo aver creato un utente
    return user;
  }

  // Product operations
  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    if (category === "All") {
      return Array.from(this.products.values());
    }
    return Array.from(this.products.values()).filter(
      (product) => product.category === category,
    );
  }

  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.productId++;
    const product: Product = { 
      ...insertProduct, 
      id,
      available: insertProduct.available !== undefined ? insertProduct.available : true 
    };
    this.products.set(id, product);
    this.saveData(); // Salva dopo la creazione di un prodotto
    return product;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const existingProduct = this.products.get(id);
    if (!existingProduct) {
      return undefined;
    }
    
    const updatedProduct = { ...existingProduct, ...product };
    this.products.set(id, updatedProduct);
    this.saveData(); // Salva dopo l'aggiornamento di un prodotto
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const existingProduct = this.products.get(id);
    if (!existingProduct) {
      return false;
    }
    
    this.products.delete(id);
    this.saveData(); // Salva dopo l'eliminazione di un prodotto
    return true;
  }

  // Order operations
  async getOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getOrdersByUser(userId: number): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.userId === userId,
    );
  }

  async getOrdersByDate(date: Date): Promise<Order[]> {
    const targetDate = new Date(date.toDateString());
    return Array.from(this.orders.values()).filter((order) => {
      const orderDate = new Date(order.orderDate.toDateString());
      return orderDate.getTime() === targetDate.getTime();
    });
  }
  
  async getOrdersByGroup(groupName: string): Promise<Order[]> {
    console.log(`getOrdersByGroup chiamato con gruppo: "${groupName}"`);
    
    const orders = Array.from(this.orders.values());
    const result: Order[] = [];
    
    // Per ogni ordine, ottieni l'utente e verifica il gruppo
    for (const order of orders) {
      const user = this.users.get(order.userId);
      console.log(`Verificando ordine ${order.id}, utente: ${user?.firstName} ${user?.lastName}, gruppo utente: "${user?.groupName}"`);
      
      // Verifica case insensitive per maggiore flessibilità
      if (user && user.groupName && groupName && 
          user.groupName.toLowerCase() === groupName.toLowerCase()) {
        console.log(`Ordine ${order.id} aggiunto ai risultati`);
        result.push(order);
      }
    }
    
    console.log(`getOrdersByGroup: trovati ${result.length} ordini per il gruppo ${groupName}`);
    return result;
  }

  async getOrderById(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = this.orderId++;
    const order: Order = { 
      ...insertOrder, 
      id, 
      createdAt: new Date(),
      status: insertOrder.status || "pending"
    };
    this.orders.set(id, order);
    this.saveData(); // Salva dopo la creazione di un ordine
    return order;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const existingOrder = this.orders.get(id);
    if (!existingOrder) {
      return undefined;
    }
    
    const updatedOrder = { ...existingOrder, status };
    this.orders.set(id, updatedOrder);
    this.saveData(); // Salva dopo l'aggiornamento dello stato di un ordine
    return updatedOrder;
  }

  // Order items operations
  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values()).filter(
      (item) => item.orderId === orderId,
    );
  }

  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const id = this.orderItemId++;
    const orderItem: OrderItem = { ...insertOrderItem, id };
    this.orderItems.set(id, orderItem);
    this.saveData(); // Salva dopo la creazione di un elemento dell'ordine
    return orderItem;
  }
  
  // Operazioni per la gestione dei gruppi
  async getAvailableGroups(): Promise<string[]> {
    try {
      // Se abbiamo già un elenco di gruppi salvato, lo restituiamo
      if (this.availableGroups && this.availableGroups.length > 0) {
        return this.availableGroups;
      }
      
      // Altrimenti, estraiamo tutti i gruppi dagli utenti esistenti
      const users = await this.getAllUsers();
      const groups = Array.from(new Set(
        users
          .map(user => user.groupName)
          .filter(Boolean) // Filtra valori null/undefined
          .filter(groupName => groupName !== "Admin") // Esclude il gruppo Admin
      )).sort();
      
      // Se non ci sono gruppi dagli utenti, restituiamo i gruppi di default
      if (groups.length === 0) {
        const defaultGroups = [
          "Team A", "Team B", "Team C", "Team D", "Team E",
          "Office 1", "Office 2", "Office 3",
          "Department 1", "Department 2", "Department 3"
        ];
        this.availableGroups = defaultGroups;
        return defaultGroups;
      }
      
      // Altrimenti salviamo e restituiamo i gruppi trovati
      this.availableGroups = groups;
      return groups;
    } catch (error) {
      console.error("Errore nel recupero dei gruppi:", error);
      // In caso di errore, restituiamo un array vuoto
      return [];
    }
  }
  
  async updateAvailableGroups(groups: string[]): Promise<string[]> {
    try {
      // Aggiorna la lista dei gruppi disponibili
      this.availableGroups = [...groups].sort();
      
      // Salva il nuovo elenco di gruppi nel file separato
      Storage.saveData('availableGroups', this.availableGroups);
      
      return this.availableGroups;
    } catch (error) {
      console.error("Errore nell'aggiornamento dei gruppi:", error);
      return this.availableGroups || [];
    }
  }
  
  async promoteMembers(): Promise<{ updated: number, groups: { from: string, to: string }[], deleted: number }> {
    const updatedGroups: { from: string, to: string }[] = [];
    let updatedCount = 0;
    let deletedCount = 0;
    
    // Ottiene tutti gli utenti
    const allUsers = Array.from(this.users.values());
    
    // Filtra tutti i membri (escludendo gli amministratori)
    const members = allUsers.filter(user => user.groupName !== "Admin");
    
    for (const member of members) {
      const groupName = member.groupName;
      
      // Verifica se il gruppo ha un formato valido (es. Team 1, Office 2, etc.)
      const match = groupName.match(/^(.+)\s+(\d+)$/);
      
      if (match) {
        const groupType = match[1];
        const currentLevel = parseInt(match[2], 10);
        
        // Se il membro è al livello massimo (es. 5), eliminalo invece di promuoverlo
        if (currentLevel >= 5) {
          // Elimina il membro
          await this.deleteUser(member.id);
          deletedCount++;
          
          console.log(`Eliminato membro ${member.firstName} ${member.lastName} del gruppo ${groupName}`);
        } else {
          // Crea il nuovo gruppo incrementando il livello
          const newLevel = currentLevel + 1;
          const newGroupName = `${groupType} ${newLevel}`;
          
          // Aggiorna il gruppo del membro
          await this.updateUser(member.id, { groupName: newGroupName });
          
          updatedCount++;
          
          // Aggiungi questa modifica all'elenco
          const update = { from: groupName, to: newGroupName };
          if (!updatedGroups.some(ug => ug.from === update.from && ug.to === update.to)) {
            updatedGroups.push(update);
          }
        }
      }
    }
    
    // Salva i dati dopo aver aggiornato tutti i membri
    this.saveData();
    
    return { 
      updated: updatedCount, 
      groups: updatedGroups,
      deleted: deletedCount
    };
  }
}

export const storage = new MemStorage();
