import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useClasses } from "@/hooks/use-classes";
import { getInitials, formatCurrency } from "@/lib/utils";
import { 
  LogOut, 
  Loader2,
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Check,
  X,
  Plus,
  Settings,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Product as ProductType,
  ProductCategories,
  OrderStatus,
  InsertProduct
} from "@shared/schema";

// Type for orders with details
type OrderWithDetails = {
  id: number;
  userId: number;
  status: string;
  total: number;
  createdAt: string;
  orderDate: string;
  items: {
    id: number;
    orderId: number;
    productId: number;
    quantity: number;
    price: number;
    product?: {
      id: number;
      name: string;
      description: string;
      price: number;
    };
  }[];
  user: {
    id: number;
    firstName: string;
    lastName: string;
    groupName: string;
  };
};

export default function AdminPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const { classes } = useClasses();
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [showOnlyToday, setShowOnlyToday] = useState<boolean>(true);
  
  // Function to check if an order is from today
  const isOrderFromToday = useCallback((orderDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const orderDateObj = new Date(orderDate);
    orderDateObj.setHours(0, 0, 0, 0);
    
    return orderDateObj.getTime() === today.getTime();
  }, []);
  const [newProduct, setNewProduct] = useState<{
    name: string;
    description: string;
    price: string;
    category: string;
    available: boolean;
  }>({
    name: "",
    description: "",
    price: "",
    category: Object.values(ProductCategories)[0],
    available: true
  });

  // Fetch products
  const { data: products, isLoading: isLoadingProducts } = useQuery<ProductType[]>({
    queryKey: ["/api/products"],
  });

  // Fetch all orders (for admin)
  const { data: orders, isLoading: isLoadingOrders } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/admin/orders"],
  });

  // Mutation for updating order status
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number, status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/orders/${orderId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      toast({
        title: "Order status updated",
        description: "The order status has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "An error occurred while updating the order status.",
        variant: "destructive",
      });
    }
  });

  // Mutation for adding new product
  const addProductMutation = useMutation({
    mutationFn: async (productData: InsertProduct) => {
      const res = await apiRequest("POST", "/api/products", productData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsAddProductOpen(false);
      setNewProduct({
        name: "",
        description: "",
        price: "",
        category: Object.values(ProductCategories)[0],
        available: true
      });
      toast({
        title: "Product added",
        description: "The new product has been successfully added.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "An error occurred while adding the new product.",
        variant: "destructive",
      });
    }
  });

  const handleViewOrderDetails = (order: OrderWithDetails) => {
    setSelectedOrder(order);
    setIsOrderDetailsOpen(true);
  };

  const handleAcceptOrder = (orderId: number) => {
    updateOrderStatusMutation.mutate({ orderId, status: OrderStatus.COMPLETED });
    setIsOrderDetailsOpen(false);
  };

  const handleRejectOrder = (orderId: number) => {
    updateOrderStatusMutation.mutate({ orderId, status: OrderStatus.CANCELLED });
    setIsOrderDetailsOpen(false);
  };

  // Mutation for deleting a product
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      const res = await apiRequest("DELETE", `/api/products/${productId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product deleted",
        description: "The product has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "An error occurred while deleting the product.",
        variant: "destructive",
      });
    }
  });

  const handleDeleteProduct = (productId: number) => {
    deleteProductMutation.mutate(productId);
  };

  const handleAddProduct = () => {
    if (!newProduct.name || !newProduct.description || !newProduct.price || !newProduct.category) {
      toast({
        title: "Error",
        description: "All fields are required.",
        variant: "destructive",
      });
      return;
    }

    const price = parseFloat(newProduct.price);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Error",
        description: "The price must be a valid number greater than zero.",
        variant: "destructive",
      });
      return;
    }

    const productData: InsertProduct = {
      name: newProduct.name,
      description: newProduct.description,
      price: price,
      category: newProduct.category,
      available: newProduct.available
    };

    addProductMutation.mutate(productData);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  // Filter orders based on display preference (only today or all)
  const filteredOrders = orders ? orders.filter(order => {
    if (showOnlyToday) {
      return isOrderFromToday(order.orderDate);
    }
    return true; // If showOnlyToday is false, show all orders
  }) : [];
  
  // Calculate stats based only on completed/cancelled orders
  const processedOrders = filteredOrders.filter(order => 
    order.status === OrderStatus.COMPLETED || 
    order.status === OrderStatus.CANCELLED
  ) || [];
  const totalOrders = processedOrders.length || 0;
  const totalRevenue = processedOrders
    .filter(order => order.status === OrderStatus.COMPLETED)
    .reduce((acc, order) => acc + order.total, 0) || 0;
  const pendingOrders = filteredOrders.filter(order => order.status === OrderStatus.PENDING).length || 0;
  const completedOrders = filteredOrders.filter(order => order.status === OrderStatus.COMPLETED).length || 0;
  
  // Group orders by class
  const ordersByClass = filteredOrders.reduce((acc, order) => {
    const groupName = order.user && order.user.groupName ? order.user.groupName : "";
    
    // Ignore orders without an assigned group
    if (!groupName) {
      return acc;
    }
    
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(order);
    return acc;
  }, {} as Record<string, OrderWithDetails[]>) || {};
  
  // Calculate total products ordered (filtered by date if needed)
  const productCounts = filteredOrders.reduce((acc, order) => {
    order.items.forEach(item => {
      const productId = item.productId;
      if (!acc[productId]) {
        acc[productId] = 0;
      }
      acc[productId] += item.quantity;
    });
    return acc;
  }, {} as Record<number, number>) || {};

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-900">
              GroupOrder Hub
            </h1>
            <span className="text-sm text-gray-500">Admin Panel</span>
          </div>
          
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    {user && <span>{getInitials(user.firstName, user.lastName)}</span>}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center justify-center">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 mr-2" />
              <span>Orders</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center justify-center">
              <Package className="h-4 w-4 mr-2" />
              <span>Products</span>
            </TabsTrigger>
            <TabsTrigger value="classes" className="flex items-center justify-center">
              <Users className="h-4 w-4 mr-2" />
              <span>Groups</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Dashboard content */}
          <TabsContent value="dashboard" className="space-y-4">
            <Card className="w-full">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Statistics</h3>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="dashboard-show-only-today" className="text-sm">
                      Show today's data only
                    </Label>
                    <Switch
                      id="dashboard-show-only-today"
                      checked={showOnlyToday}
                      onCheckedChange={setShowOnlyToday}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Total Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalOrders}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Pending Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingOrders}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Completed Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completedOrders}</div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Ordered Products Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingProducts || isLoadingOrders ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead className="text-right">Quantity Ordered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products?.map(product => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.category}</TableCell>
                          <TableCell>{formatCurrency(product.price)}</TableCell>
                          <TableCell className="text-right">{productCounts[product.id] || 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders content */}
          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>All Orders</CardTitle>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="show-only-today" className="text-sm">
                    Show today's orders only
                  </Label>
                  <Switch
                    id="show-only-today"
                    checked={showOnlyToday}
                    onCheckedChange={setShowOnlyToday}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingOrders ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Ordini in attesa */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Pending Orders</h3>
                      {filteredOrders.filter(order => order.status === OrderStatus.PENDING).length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          No pending orders
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead>Group</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Order Date</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredOrders
                              .filter(order => order.status === OrderStatus.PENDING)
                              // Filter orders without group or with group "N/A"
                              .filter(order => {
                                const groupName = order.user && order.user.groupName ? order.user.groupName : "";
                                return groupName && groupName.trim() !== "" && groupName !== "N/A";
                              })
                              .sort((a, b) => b.id - a.id) // Sort by ID in descending order
                              .map(order => (
                              <TableRow key={order.id}>
                                <TableCell className="font-medium">#{order.id}</TableCell>
                                <TableCell>
                                  {order.user ? `${order.user.firstName || ""} ${order.user.lastName || ""}` : "User not available"}
                                </TableCell>
                                <TableCell>
                                  {order.user && order.user.groupName ? order.user.groupName : ""}
                                  {order.user && order.user.groupName && !classes.includes(order.user.groupName) && 
                                   <span className="text-amber-500 ml-2">(group no longer available)</span>}
                                </TableCell>
                                <TableCell>{formatCurrency(order.total)}</TableCell>
                                <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end space-x-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"
                                      onClick={() => handleViewOrderDetails(order)}
                                    >
                                      Details
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="bg-green-50 text-green-600 hover:bg-green-100 border-green-200"
                                      onClick={() => handleAcceptOrder(order.id)}
                                    >
                                      <Check className="h-4 w-4 mr-1" /> Accept
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                                      onClick={() => handleRejectOrder(order.id)}
                                    >
                                      <X className="h-4 w-4 mr-1" /> Reject
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    {/* Ordini completati */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Completed Orders</h3>
                      {filteredOrders.filter(order => order.status === OrderStatus.COMPLETED).length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          No completed orders
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead>Group</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Order Date</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredOrders
                              .filter(order => order.status === OrderStatus.COMPLETED)
                              // Filter orders without group or with group "N/A"
                              .filter(order => {
                                const groupName = order.user && order.user.groupName ? order.user.groupName : "";
                                return groupName && groupName.trim() !== "" && groupName !== "N/A";
                              })
                              .sort((a, b) => b.id - a.id) // Sort by ID in descending order
                              .map(order => (
                              <TableRow key={order.id}>
                                <TableCell className="font-medium">#{order.id}</TableCell>
                                <TableCell>
                                  {order.user ? `${order.user.firstName || ""} ${order.user.lastName || ""}` : "User not available"}
                                </TableCell>
                                <TableCell>
                                  {order.user && order.user.groupName ? order.user.groupName : ""}
                                  {order.user && order.user.groupName && !classes.includes(order.user.groupName) && 
                                   <span className="text-amber-500 ml-2">(group no longer available)</span>}
                                </TableCell>
                                <TableCell>{formatCurrency(order.total)}</TableCell>
                                <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"
                                    onClick={() => handleViewOrderDetails(order)}
                                  >
                                    Details
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    {/* Ordini annullati */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Cancelled Orders</h3>
                      {filteredOrders.filter(order => order.status === OrderStatus.CANCELLED).length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          No cancelled orders
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead>Group</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Order Date</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredOrders
                              .filter(order => order.status === OrderStatus.CANCELLED)
                              // Filter orders without group or with group "N/A"
                              .filter(order => {
                                const groupName = order.user && order.user.groupName ? order.user.groupName : "";
                                return groupName && groupName.trim() !== "" && groupName !== "N/A";
                              })
                              .sort((a, b) => b.id - a.id) // Sort by ID in descending order
                              .map(order => (
                              <TableRow key={order.id}>
                                <TableCell className="font-medium">#{order.id}</TableCell>
                                <TableCell>
                                  {order.user ? `${order.user.firstName || ""} ${order.user.lastName || ""}` : "User not available"}
                                </TableCell>
                                <TableCell>
                                  {order.user && order.user.groupName ? order.user.groupName : ""}
                                  {order.user && order.user.groupName && !classes.includes(order.user.groupName) && 
                                   <span className="text-amber-500 ml-2">(group no longer available)</span>}
                                </TableCell>
                                <TableCell>{formatCurrency(order.total)}</TableCell>
                                <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"
                                    onClick={() => handleViewOrderDetails(order)}
                                  >
                                    Details
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products content */}
          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Product Management</CardTitle>
                <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" /> New Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add New Product</DialogTitle>
                      <DialogDescription>
                        Enter the details of the new product to add to the catalog.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                          Name
                        </Label>
                        <Input
                          id="name"
                          value={newProduct.name}
                          onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="description" className="text-right">
                          Description
                        </Label>
                        <Input
                          id="description"
                          value={newProduct.description}
                          onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="price" className="text-right">
                          Price (€)
                        </Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          min="0"
                          value={newProduct.price}
                          onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">
                          Category
                        </Label>
                        <Select 
                          value={newProduct.category} 
                          onValueChange={(value) => setNewProduct({ ...newProduct, category: value })}
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(ProductCategories).map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="available" className="text-right">
                          Available
                        </Label>
                        <div className="flex items-center space-x-2 col-span-3">
                          <Switch
                            id="available"
                            checked={newProduct.available}
                            onCheckedChange={(checked) => setNewProduct({ ...newProduct, available: checked })}
                          />
                          <Label htmlFor="available" className="cursor-pointer">
                            {newProduct.available ? "Yes" : "No"}
                          </Label>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" onClick={handleAddProduct} disabled={addProductMutation.isPending}>
                        {addProductMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add Product
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {isLoadingProducts ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Availability</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products?.map(product => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">#{product.id}</TableCell>
                          <TableCell>{product.name}</TableCell>
                          <TableCell>{product.category}</TableCell>
                          <TableCell>{formatCurrency(product.price)}</TableCell>
                          <TableCell>
                            {product.available ? (
                              <span className="text-green-600">Available</span>
                            ) : (
                              <span className="text-red-600">Not available</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                                onClick={() => handleDeleteProduct(product.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Groups content */}
          <TabsContent value="classes" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Orders by Group</CardTitle>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="classes-show-only-today" className="text-sm">
                    Show today's orders only
                  </Label>
                  <Switch
                    id="classes-show-only-today"
                    checked={showOnlyToday}
                    onCheckedChange={setShowOnlyToday}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingOrders ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : Object.keys(ordersByClass).length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No orders found
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(ordersByClass)
                      // Filter empty or N/A groupName records
                      .filter(([groupName, _]) => {
                        return groupName && groupName.trim() !== "" && groupName !== "N/A";
                      })
                      .sort(([groupNameA], [groupNameB]) => {
                        // Extract numbers and letters from group (e.g. 1A -> [1, "A"])
                        const [numA, letterA] = [parseInt(groupNameA.match(/\d+/)?.[0] || "0"), groupNameA.match(/[A-Z]+/)?.[0] || ""];
                        const [numB, letterB] = [parseInt(groupNameB.match(/\d+/)?.[0] || "0"), groupNameB.match(/[A-Z]+/)?.[0] || ""];
                        
                        // First sort by number
                        if (numA !== numB) {
                          return numA - numB;
                        }
                        // If numbers are equal, sort by letter
                        return letterA.localeCompare(letterB);
                      })
                      .map(([groupName, classOrders]) => (
                      <div key={groupName} className="border rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-2">Group {groupName}</h3>
                        <div className="text-sm text-gray-500 mb-4">
                          {classOrders.length} orders - Total: {formatCurrency(
                            classOrders.reduce((sum, order) => sum + order.total, 0)
                          )}
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {classOrders.map(order => (
                              <TableRow key={order.id}>
                                <TableCell className="font-medium">#{order.id}</TableCell>
                                <TableCell>
                                  {order.user ? `${order.user.firstName || ""} ${order.user.lastName || ""}` : "User not available"}
                                </TableCell>
                                <TableCell>
                                  {order.status === OrderStatus.PENDING && <span className="text-yellow-600">Pending</span>}
                                  {order.status === OrderStatus.PROCESSING && <span className="text-blue-600">Processing</span>}
                                  {order.status === OrderStatus.COMPLETED && <span className="text-green-600">Completed</span>}
                                  {order.status === OrderStatus.CANCELLED && <span className="text-red-600">Cancelled</span>}
                                </TableCell>
                                <TableCell>{formatCurrency(order.total)}</TableCell>
                                <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                                <TableCell className="text-right">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"
                                    onClick={() => handleViewOrderDetails(order)}
                                  >
                                    Details
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Dialog per i dettagli dell'ordine */}
      <Dialog open={isOrderDetailsOpen} onOpenChange={setIsOrderDetailsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Order Details #{selectedOrder?.id}</DialogTitle>
            <DialogDescription>
              Detailed order information
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Customer</h4>
                  <p className="font-medium">
                    {selectedOrder.user ? `${selectedOrder.user.firstName || ""} ${selectedOrder.user.lastName || ""}` : "Utente non disponibile"}
                  </p>
                  <p className="text-sm text-gray-500">
                    Group {selectedOrder.user && selectedOrder.user.groupName ? selectedOrder.user.groupName : ""}
                    {selectedOrder.user && selectedOrder.user.groupName && !classes.includes(selectedOrder.user.groupName) && 
                      <span className="text-amber-500 ml-2">(Group no longer exists)</span>}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Order Info</h4>
                  <p className="text-sm">Date: {new Date(selectedOrder.orderDate).toLocaleDateString()}</p>
                  <p className="text-sm">Status: 
                    {selectedOrder.status === OrderStatus.PENDING && <span className="text-yellow-600"> Pending</span>}
                    {selectedOrder.status === OrderStatus.PROCESSING && <span className="text-blue-600"> Processing</span>}
                    {selectedOrder.status === OrderStatus.COMPLETED && <span className="text-green-600"> Completed</span>}
                    {selectedOrder.status === OrderStatus.CANCELLED && <span className="text-red-600"> Cancelled</span>}
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Ordered Products</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {products?.find(p => p.id === item.productId)?.name || item.product?.name || ""}
                        </TableCell>
                        <TableCell>{formatCurrency(item.price)}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.price * item.quantity)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-medium">Order Total</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(selectedOrder.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              
              {selectedOrder.status === OrderStatus.PENDING && (
                <DialogFooter className="flex justify-between">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsOrderDetailsOpen(false)}
                  >
                    Close
                  </Button>
                  <div className="space-x-2">
                    <Button 
                      variant="outline" 
                      className="bg-green-50 text-green-600 hover:bg-green-100 border-green-200"
                      onClick={() => handleAcceptOrder(selectedOrder.id)}
                    >
                      <Check className="h-4 w-4 mr-1" /> Accept Order
                    </Button>
                    <Button 
                      variant="outline" 
                      className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                      onClick={() => handleRejectOrder(selectedOrder.id)}
                    >
                      <X className="h-4 w-4 mr-1" /> Reject Order
                    </Button>
                  </div>
                </DialogFooter>
              )}
              
              {selectedOrder.status !== OrderStatus.PENDING && (
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsOrderDetailsOpen(false)}
                  >
                    Close
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}