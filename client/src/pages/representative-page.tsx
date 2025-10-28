import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, Package, Clock, RotateCcw, CheckCircle, Home } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { OrderStatus } from "@shared/schema";
import { Link } from "wouter";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Order status translations
const orderStatusTranslations = {
  [OrderStatus.PENDING]: "Pending",
  [OrderStatus.PROCESSING]: "Processing",
  [OrderStatus.COMPLETED]: "Completed",
  [OrderStatus.CANCELLED]: "Cancelled"
};

// Color map for statuses
const orderStatusColors = {
  [OrderStatus.PENDING]: "bg-yellow-100 text-yellow-800",
  [OrderStatus.PROCESSING]: "bg-blue-100 text-blue-800",
  [OrderStatus.COMPLETED]: "bg-green-100 text-green-800",
  [OrderStatus.CANCELLED]: "bg-red-100 text-red-800"
};

// Icon map for statuses
const OrderStatusIcon = ({ status }: { status: string }) => {
  switch(status) {
    case OrderStatus.PENDING:
      return <Clock className="h-4 w-4 mr-1" />;
    case OrderStatus.PROCESSING:
      return <Package className="h-4 w-4 mr-1" />;
    case OrderStatus.COMPLETED:
      return <CheckCircle className="h-4 w-4 mr-1" />;
    case OrderStatus.CANCELLED:
      return <X className="h-4 w-4 mr-1" />;
    default:
      return null;
  }
};

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

export default function RepresentativePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [showOnlyToday, setShowOnlyToday] = useState<boolean>(true);
  
  // Function to check if an order is from today
  const isOrderFromToday = useCallback((orderDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const orderDateObj = new Date(orderDate);
    orderDateObj.setHours(0, 0, 0, 0);
    
    return orderDateObj.getTime() === today.getTime();
  }, []);

  // Fetch orders for the coordinator's group
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["/api/admin/orders/group", user?.groupName, selectedDate],
    queryFn: async () => {
      console.log("Fetching orders for group:", user?.groupName);
      // We use a direct API call without requiring authentication
      const res = await fetch(`/api/admin/orders/group/${encodeURIComponent(user?.groupName || "")}`);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Error loading orders:", errorText);
        throw new Error("Error loading orders: " + errorText);
      }
      
      const data = await res.json();
      console.log("Received orders data:", data);
      return data;
    },
    enabled: !!user?.groupName
  });

  // Fetch products to display order details
  const { data: products } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Error loading products");
      return res.json();
    }
  });

  // Processing orders with product details
  const processedOrders = orders ? orders.map((order: OrderWithDetails) => {
    return {
      ...order,
      items: order.items.map(item => ({
        ...item,
        product: products?.find((p: any) => p.id === item.productId)
      }))
    };
  }) : [];

  // Group orders by status
  const ordersByStatus = processedOrders.reduce((acc: Record<string, OrderWithDetails[]>, order: OrderWithDetails) => {
    if (!acc[order.status]) {
      acc[order.status] = [];
    }
    acc[order.status].push(order);
    return acc;
  }, {});

  // Get a count of products from all completed orders
  interface OrderItem {
    productId: number;
    quantity: number;
    product?: {
      name: string;
      id: number;
    };
  }

  interface ProductSummary {
    [key: string]: { 
      quantity: number; 
      name: string;
    };
  }

  const productSummary: ProductSummary = processedOrders
    .filter((order: OrderWithDetails) => 
      // Filter by order status
      (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.PROCESSING) &&
      // Filter by date if showOnlyToday is active
      (!showOnlyToday || isOrderFromToday(order.orderDate))
    )
    .flatMap((order: OrderWithDetails) => order.items)
    .reduce((acc: ProductSummary, item: OrderItem) => {
      if (!item.product) return acc;
      
      const key = item.productId.toString();
      if (!acc[key]) {
        acc[key] = {
          quantity: 0,
          name: item.product.name
        };
      }
      acc[key].quantity += item.quantity;
      return acc;
    }, {} as ProductSummary);

  // Handle order selection
  const handleOrderSelect = (order: OrderWithDetails) => {
    setSelectedOrder(order);
    setOrderDetailsOpen(true);
  };

  // Format the date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  };

  // Component for the summary
  const OrderSummary = () => (
    <Card>
      <CardHeader>
        <CardTitle>Product Summary</CardTitle>
        <CardDescription>
          Total products for processing and completed orders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(productSummary).length > 0 ? (
              Object.entries(productSummary).map(entry => {
                const [id, summary] = entry;
                return (
                  <TableRow key={id}>
                    <TableCell className="font-medium">{summary.name}</TableCell>
                    <TableCell className="text-right">{summary.quantity}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">
                  No products to display
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  // Component for order details
  const OrderDetailsDialog = () => (
    <Dialog open={orderDetailsOpen} onOpenChange={setOrderDetailsOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Order Details #{selectedOrder?.id}</DialogTitle>
          <DialogDescription>
            Placed by {selectedOrder?.user?.firstName} {selectedOrder?.user?.lastName} - {selectedOrder?.user?.groupName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">Order Status</p>
              <Badge
                className={`${
                  selectedOrder && Object.prototype.hasOwnProperty.call(orderStatusColors, selectedOrder.status)
                    ? orderStatusColors[selectedOrder.status as keyof typeof orderStatusColors]
                    : "bg-gray-100 text-gray-800"
                } flex items-center`}
              >
                {selectedOrder && <OrderStatusIcon status={selectedOrder.status} />}
                {selectedOrder && Object.prototype.hasOwnProperty.call(orderStatusTranslations, selectedOrder.status)
                  ? orderStatusTranslations[selectedOrder.status as keyof typeof orderStatusTranslations]
                  : selectedOrder?.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Order Date</p>
              <p className="font-medium">
                {selectedOrder && formatDate(selectedOrder.orderDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="font-medium">
                {selectedOrder && formatCurrency(selectedOrder.total)}
              </p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-center">Quantity</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedOrder?.items.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.product?.name}
                  </TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.price * item.quantity)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot>
              <tr>
                <td colSpan={3} className="text-right py-4 font-semibold">
                  Order Total:
                </td>
                <td className="text-right py-4 font-semibold">
                  {selectedOrder && formatCurrency(selectedOrder.total)}
                </td>
              </tr>
            </tfoot>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Component for the orders list
  const OrdersList = ({ status }: { status: string }) => {
    // Ensure that ordersByStatus contains the status property, if not, initialize as empty array
    const baseOrders = ordersByStatus[status] || [];
    
    // Filter by date if showOnlyToday is active
    const filteredOrders = showOnlyToday 
      ? baseOrders.filter((order: OrderWithDetails) => isOrderFromToday(order.orderDate)).sort((a: OrderWithDetails, b: OrderWithDetails) => b.id - a.id) // Sort by ID in descending order
      : baseOrders.sort((a: OrderWithDetails, b: OrderWithDetails) => b.id - a.id);
    
    // We use the safe value for translation
    const statusTranslation = Object.prototype.hasOwnProperty.call(orderStatusTranslations, status) 
      ? orderStatusTranslations[status as keyof typeof orderStatusTranslations]
      : status;
    
    return (
      <div className="space-y-4">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order: OrderWithDetails) => (
            <Card key={order.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">
                    Order #{order.id}
                  </CardTitle>
                  <Badge
                    className={`${
                      Object.prototype.hasOwnProperty.call(orderStatusColors, order.status)
                        ? orderStatusColors[order.status as keyof typeof orderStatusColors]
                        : "bg-gray-100 text-gray-800"
                    } flex items-center`}
                  >
                    <OrderStatusIcon status={order.status} />
                    {Object.prototype.hasOwnProperty.call(orderStatusTranslations, order.status)
                      ? orderStatusTranslations[order.status as keyof typeof orderStatusTranslations]
                      : order.status}
                  </Badge>
                </div>
                <CardDescription>
                  {order.user?.firstName} {order.user?.lastName} - {order.user?.groupName}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="flex justify-between text-sm">
                  <div>
                    <p className="text-gray-500">Date</p>
                    <p>{formatDate(order.orderDate)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total</p>
                    <p className="font-bold">{formatCurrency(order.total)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Products</p>
                    <p>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-gray-50 flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleOrderSelect(order)}
                >
                  View Details
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No {statusTranslation.toLowerCase()} orders</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Management</h1>
          <p className="text-gray-500">
            View and manage orders for group {user?.groupName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Button variant="outline" size="icon" asChild>
            <Link href="/" className="flex items-center justify-center" title="Back to Home">
              <Home className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="flex justify-between items-center mb-4">
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
          </div>
          
          <Tabs defaultValue={OrderStatus.PENDING} className="w-full">
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value={OrderStatus.PENDING}>
                Pending
              </TabsTrigger>
              <TabsTrigger value={OrderStatus.COMPLETED}>
                Completed
              </TabsTrigger>
            </TabsList>

            <TabsContent value={OrderStatus.PENDING}>
              <OrdersList status={OrderStatus.PENDING} />
            </TabsContent>
            
            <TabsContent value={OrderStatus.COMPLETED}>
              <OrdersList status={OrderStatus.COMPLETED} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <OrderSummary />
        </div>
      </div>

      {selectedOrder && <OrderDetailsDialog />}
    </div>
  );
}