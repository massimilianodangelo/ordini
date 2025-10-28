import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useClasses } from "@/hooks/use-classes";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Edit,
  UserPlus,
  AlertCircle,
  Search,
  RefreshCw,
  Trash2,
  User as UserIcon,
  LogOut,
  Plus,
  X,
  ChevronDown,
  Settings,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { Switch } from "@/components/ui/switch";

// Schema for creating a new user
const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").email("Must be a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  groupName: z.string(),
  isCoordinator: z.boolean().default(false),
  isAdmin: z.boolean().default(false),
  isUserAdmin: z.boolean().default(false),
}).refine((data) => {
  // If the user is an administrator (isAdmin or isUserAdmin), group is not required
  // otherwise group selection is mandatory
  if (data.isAdmin || data.isUserAdmin) {
    return true;
  } else {
    return data.groupName.length > 0;
  }
}, {
  message: "Select a group (required for non-admin users)",
  path: ["groupName"]
});

// Schema for modifying an existing user
const updateUserSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  groupName: z.string(),
  isCoordinator: z.boolean().default(false),
  isAdmin: z.boolean().default(false),
  isUserAdmin: z.boolean().default(false),
  password: z.string().optional(),
}).refine((data) => {
  // If the user is an administrator (isAdmin or isUserAdmin), group is not required
  // otherwise group selection is mandatory
  if (data.isAdmin || data.isUserAdmin) {
    return true;
  } else {
    return data.groupName.length > 0;
  }
}, {
  message: "Select a group (required for non-admin users)",
  path: ["groupName"]
});

type UserWithoutPassword = Omit<User, "password">;

export default function UserAdminPage() {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithoutPassword | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Using the useClasses hook to manage available groups centrally
  const { classes: availableClasses, updateClasses } = useClasses();
  
  // State for the new group to add
  const [newClass, setNewClass] = useState("");
  const [isManageClassesOpen, setIsManageClassesOpen] = useState(false);

  // Retrieve all users
  const { data: apiUsers, isLoading, refetch } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/admin/users"],
    staleTime: 10000,
    retry: 1
  });
  
  // Using only data from the database, no longer hardcoded
  const users = useMemo(() => {
    if (!apiUsers) return [];
    return apiUsers;
  }, [apiUsers]);

  // Form for creating a new user
  const createUserForm = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      groupName: "",

      isCoordinator: false,
      isAdmin: false,
      isUserAdmin: false,
    },
  });

  // Form for modifying an existing user
  const editUserForm = useForm<z.infer<typeof updateUserSchema>>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      groupName: "",
      isCoordinator: false,
      isAdmin: false,
      isUserAdmin: false,
      password: "",
    },
  });

  // Mutation to create a new user
  const createUserMutation = useMutation({
    mutationFn: async (userData: z.infer<typeof createUserSchema>) => {
      const res = await apiRequest("POST", "/api/admin/users", userData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User created",
        description: "The user has been successfully created.",
      });
      setIsCreateUserDialogOpen(false);
      createUserForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Could not create user: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to modify an existing user
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: number; userData: z.infer<typeof updateUserSchema> }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, userData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User updated",
        description: "The user has been successfully updated.",
      });
      setIsEditUserDialogOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Could not update user: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Handler for creating a new user
  const onCreateUserSubmit = (data: z.infer<typeof createUserSchema>) => {
    // If user is administrator, automatically set the group to "Admin"
    if (data.isAdmin || data.isUserAdmin) {
      data.groupName = "Admin";
    }
    createUserMutation.mutate(data);
  };

  // Handler for modifying an existing user
  const onEditUserSubmit = (data: z.infer<typeof updateUserSchema>) => {
    if (!selectedUser) return;
    
    // If user is administrator, automatically set the group to "Admin"
    if (data.isAdmin || data.isUserAdmin) {
      data.groupName = "Admin";
    }
    
    // If password is empty, remove it from the object
    if (!data.password) {
      const { password, ...rest } = data;
      updateUserMutation.mutate({ id: selectedUser.id, userData: rest });
    } else {
      updateUserMutation.mutate({ id: selectedUser.id, userData: data });
    }
  };

  // Handler to open the edit user dialog
  const handleEditUser = (user: UserWithoutPassword) => {
    if (isDemoMode) {
      toast({
        title: "Demo Mode",
        description: "User editing is disabled in demo mode.",
        variant: "destructive",
      });
      return;
    }
    setSelectedUser(user);
    editUserForm.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      groupName: user.groupName,
      isCoordinator: user.isCoordinator ?? false,
      isAdmin: user.isAdmin ?? false,
      isUserAdmin: user.isUserAdmin ?? false,
      password: "",
    });
    setIsEditUserDialogOpen(true);
  };

  // Mutation to delete a user
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "The user has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Could not delete user: " + error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handler to delete a user
  const handleDeleteUser = (id: number) => {
    if (isDemoMode) {
      toast({
        title: "Demo Mode",
        description: "User deletion is disabled in demo mode.",
        variant: "destructive",
      });
      return;
    }
    if (window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      deleteUserMutation.mutate(id);
    }
  };
  
  // Mutation to delete all non-admin users
  const deleteAllNonAdminUsersMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/admin/users/students/all");
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Users deleted",
        description: `${data.count} member and coordinator users have been deleted.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Could not delete users: " + error.message,
        variant: "destructive",
      });
    },
  });
  
  
  // Handler to delete all non-admin users
  const handleDeleteAllNonAdminUsers = () => {
    if (window.confirm("WARNING: You are about to delete ALL member and coordinator users. This action will also delete their orders and cannot be undone. Are you sure you want to proceed?")) {
      deleteAllNonAdminUsersMutation.mutate();
    }
  };
  
  
  // Functions to manage groups using the centralized useClasses hook
  const handleAddClass = () => {
    if (!newClass.trim()) {
      toast({
        title: "Error",
        description: "Enter a valid group name",
        variant: "destructive",
      });
      return;
    }
    
    if (availableClasses.includes(newClass.trim())) {
      toast({
        title: "Error",
        description: "This group already exists",
        variant: "destructive",
      });
      return;
    }
    
    // Update groups using the updateClasses method of the centralized hook
    const updatedClasses = [...availableClasses, newClass.trim()].sort();
    updateClasses(updatedClasses);
    setNewClass("");
    toast({
      title: "Group added",
      description: `The group ${newClass.trim()} has been successfully added.`,
    });
  };
  
  const handleRemoveClass = (className: string) => {
    // Check if there are users in this group
    const usersInClass = users?.filter(u => u.groupName === className) || [];
    
    if (usersInClass.length > 0) {
      toast({
        title: "Cannot remove",
        description: `There are ${usersInClass.length} users assigned to this group. Reassign them before deleting it.`,
        variant: "destructive",
      });
      return;
    }
    
    // Update groups using the updateClasses method of the centralized hook
    const updatedClasses = availableClasses.filter((c: string) => c !== className);
    updateClasses(updatedClasses);
    toast({
      title: "Group removed",
      description: `The group ${className} has been successfully removed.`,
    });
  };
  
  // Filter users based on search and sort by ID in ascending order
  const filteredUsers = users
    ? users
        .filter(
          (user) =>
            user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.groupName.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => a.id - b.id) // Sort users by ID in ascending order
    : [];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-800">GroupOrder Hub</h1>
            <span className="ml-4 text-sm text-gray-500 hidden md:inline-block">
              User Management
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                {user && (
                  <span>
                    {user.firstName} {user.lastName}
                  </span>
                )}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/")}>
                Home
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-500 focus:text-red-500" 
                onClick={() => logoutMutation.mutate()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-medium text-gray-900">User Management</h2>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Search users..."
                      className="pl-9 pr-3"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => refetch()}
                    variant="outline"
                    size="icon"
                    title="Refresh"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  {!isDemoMode && user?.isUserAdmin && (
                    <Button 
                      onClick={() => setIsManageClassesOpen(true)} 
                      variant="outline"
                    >
                      Manage Groups
                    </Button>
                  )}
                  {!isDemoMode && (
                    <Button onClick={() => setIsCreateUserDialogOpen(true)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      New User
                    </Button>
                  )}
                </div>
              </div>
              
              {isDemoMode && (
                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <p className="text-sm text-yellow-800 font-medium">
                    <AlertCircle className="inline h-4 w-4 mr-2" />
                    Demo Mode - User management features (add, edit, delete) are disabled for demonstration purposes.
                  </p>
                </div>
              )}

              {/* Tabs per visualizzare gli utenti */}
              <Tabs defaultValue="list">
                <TabsList className="mb-4">
                  <TabsTrigger value="list">Complete list</TabsTrigger>
                  <TabsTrigger value="byClass">Users by group</TabsTrigger>
                </TabsList>
                
                <TabsContent value="list">
                  {/* Tabella utenti */}
                  {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : filteredUsers && filteredUsers.length > 0 ? (
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <div className="sm:hidden">
                        {/* Mobile view - Cards instead of table */}
                        <div className="space-y-4 px-4">
                          {filteredUsers.map((user) => (
                            <div key={user.id} className="bg-white p-4 rounded-lg shadow-sm border">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-medium">{user.firstName} {user.lastName}</p>
                                  <p className="text-sm text-gray-500">{user.username}</p>
                                </div>
                                <div className="text-sm text-gray-500">
                                  ID: {user.id} - {user.groupName}
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-1 mb-3">
                                {user.isAdmin && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Administrator
                                  </span>
                                )}
                                {user.isUserAdmin && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    User Admin
                                  </span>
                                )}
                                {user.isCoordinator && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Coordinator
                                  </span>
                                )}
                                {!user.isAdmin && !user.isCoordinator && !user.isUserAdmin && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    User
                                  </span>
                                )}
                              </div>
                              
                              {!isDemoMode && (
                                <div className="flex space-x-2 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditUser(user)}
                                  >
                                    <Edit className="h-4 w-4 mr-1" /> Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Desktop view - Table */}
                      <div className="hidden sm:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>First Name</TableHead>
                              <TableHead>Last Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Group</TableHead>
                              <TableHead>Roles</TableHead>
                              {!isDemoMode && <TableHead>Actions</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredUsers.map((user) => (
                              <TableRow key={user.id}>
                                <TableCell>{user.id}</TableCell>
                                <TableCell>{user.firstName}</TableCell>
                                <TableCell>{user.lastName}</TableCell>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{user.groupName}</TableCell>
                                <TableCell>
                                  <div className="flex flex-col space-y-1">
                                    {user.isAdmin && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Administrator
                                      </span>
                                    )}
                                    {user.isUserAdmin && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                        User Admin
                                      </span>
                                    )}
                                    {user.isCoordinator && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Coordinator
                                      </span>
                                    )}
                                    {!user.isAdmin && !user.isCoordinator && !user.isUserAdmin && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        User
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                {!isDemoMode && (
                                  <TableCell>
                                    <div className="flex space-x-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditUser(user)}
                                      >
                                        <Edit className="h-4 w-4 mr-1" /> Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <AlertCircle className="mx-auto h-8 w-8 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {searchQuery
                            ? "No users match the search criteria."
                            : "There are no users in the system yet."}
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="byClass">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : filteredUsers && filteredUsers.length > 0 ? (
                    <div className="space-y-8">
                      {/* Group users by group */}
                      {Array.from(
                        new Set(
                          filteredUsers
                            .map(user => user.groupName)
                            .filter(className => className !== "Admin") // Filter Admin group
                        )
                      ).sort().map(className => {
                        const usersInClass = filteredUsers.filter(u => u.groupName === className);
                        return (
                          <div key={className} className="bg-white rounded-lg p-4 shadow-sm border">
                            <h3 className="text-lg font-medium mb-4">Group {className} ({usersInClass.length} users)</h3>
                            
                            {/* Mobile view for group users */}
                            <div className="sm:hidden">
                              <div className="space-y-4">
                                {usersInClass.map((user) => (
                                  <div key={user.id} className="bg-gray-50 p-3 rounded-lg">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <p className="font-medium">{user.firstName} {user.lastName}</p>
                                        <p className="text-sm text-gray-500">{user.username}</p>
                                      </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-1 mb-3">
                                      {user.isCoordinator && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          Coordinator
                                        </span>
                                      )}
                                      {!user.isAdmin && !user.isCoordinator && !user.isUserAdmin && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                          User
                                        </span>
                                      )}
                                    </div>
                                    
                                    <div className="flex space-x-2 justify-end">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditUser(user)}
                                      >
                                        <Edit className="h-4 w-4 mr-1" /> Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Desktop view for group users */}
                            <div className="hidden sm:block overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>First Name</TableHead>
                                    <TableHead>Last Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Roles</TableHead>
                                    <TableHead>Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {usersInClass.map((user) => (
                                    <TableRow key={user.id}>
                                      <TableCell>{user.firstName}</TableCell>
                                      <TableCell>{user.lastName}</TableCell>
                                      <TableCell>{user.username}</TableCell>
                                      <TableCell>
                                        <div className="flex flex-col space-y-1">
                                          {user.isCoordinator && (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                              Coordinator
                                            </span>
                                          )}
                                          {!user.isAdmin && !user.isCoordinator && !user.isUserAdmin && (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                              User
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex space-x-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditUser(user)}
                                          >
                                            <Edit className="h-4 w-4 mr-1" /> Edit
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                          >
                                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Administrators section */}
                      {filteredUsers.some(user => user.groupName === "Admin") && (
                        <div className="bg-white rounded-lg p-4 shadow-sm border">
                          <h3 className="text-lg font-medium mb-4">System Administrators</h3>
                          
                          {/* Mobile view for administrators */}
                          <div className="sm:hidden">
                            <div className="space-y-4">
                              {filteredUsers.filter(u => u.groupName === "Admin").map((user) => (
                                <div key={user.id} className="bg-gray-50 p-3 rounded-lg">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <p className="font-medium">{user.firstName} {user.lastName}</p>
                                      <p className="text-sm text-gray-500">{user.username}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-1 mb-3">
                                    {user.isAdmin && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        Administrator
                                      </span>
                                    )}
                                    {user.isUserAdmin && (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                        User Admin
                                      </span>
                                    )}
                                  </div>
                                  
                                  {!isDemoMode && (
                                    <div className="flex space-x-2 justify-end">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditUser(user)}
                                      >
                                        <Edit className="h-4 w-4 mr-1" /> Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Desktop view for administrators */}
                          <div className="hidden sm:block overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>First Name</TableHead>
                                  <TableHead>Last Name</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Roles</TableHead>
                                  {!isDemoMode && <TableHead>Actions</TableHead>}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredUsers.filter(u => u.groupName === "Admin").map((user) => (
                                  <TableRow key={user.id}>
                                    <TableCell>{user.firstName}</TableCell>
                                    <TableCell>{user.lastName}</TableCell>
                                    <TableCell>{user.username}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-col space-y-1">
                                        {user.isAdmin && (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            Administrator
                                          </span>
                                        )}
                                        {user.isUserAdmin && (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                            User Admin
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    {!isDemoMode && (
                                      <TableCell>
                                        <div className="flex space-x-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditUser(user)}
                                          >
                                            <Edit className="h-4 w-4 mr-1" /> Edit
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteUser(user.id)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                          >
                                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                                          </Button>
                                        </div>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <AlertCircle className="mx-auto h-8 w-8 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {searchQuery
                            ? "No users match the search criteria."
                            : "There are no users in the system yet."}
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>

      {/* Dialog per creare un nuovo utente */}
      <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new user</DialogTitle>
          </DialogHeader>
          <Form {...createUserForm}>
            <form onSubmit={createUserForm.handleSubmit(onCreateUserSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createUserForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Mario" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createUserForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Rossi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createUserForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email / Username</FormLabel>
                    <FormControl>
                      <Input placeholder="mario.rossi@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />



              <FormField
                control={createUserForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Campo gruppo (mostrato solo per utenti non amministratori) */}
              {!(createUserForm.watch("isAdmin") || createUserForm.watch("isUserAdmin")) && (
                <FormField
                  control={createUserForm.control}
                  name="groupName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select group" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableClasses.sort().map(className => (
                            <SelectItem key={className} value={className}>
                              {className}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Separator />
              <div className="text-sm font-medium mb-2">Roles</div>

              <div className="space-y-4">
                <FormField
                  control={createUserForm.control}
                  name="isCoordinator"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>Group Coordinator</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={createUserForm.control}
                  name="isAdmin"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>Administrator (orders and products management)</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={createUserForm.control}
                  name="isUserAdmin"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>User Administrator</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateUserDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create user"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog per modificare un utente esistente */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit user: {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogTitle>
          </DialogHeader>
          <Form {...editUserForm}>
            <form onSubmit={editUserForm.handleSubmit(onEditUserSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editUserForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editUserForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Campo gruppo (mostrato solo per utenti non amministratori) */}
              {!(editUserForm.watch("isAdmin") || editUserForm.watch("isUserAdmin")) && (
                <FormField
                  control={editUserForm.control}
                  name="groupName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select group" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableClasses.sort().map(className => (
                            <SelectItem key={className} value={className}>
                              {className}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={editUserForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nuova Password (lasciare vuoto per non modificare)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />
              <div className="text-sm font-medium mb-2">Roles</div>

              <div className="space-y-4">
                <FormField
                  control={editUserForm.control}
                  name="isCoordinator"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>Group Coordinator</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={editUserForm.control}
                  name="isAdmin"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>Administrator (orders and products management)</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={editUserForm.control}
                  name="isUserAdmin"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>User Administrator</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditUserDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog per gestire i gruppi */}
      <Dialog open={isManageClassesOpen} onOpenChange={setIsManageClassesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Groups</DialogTitle>
            <DialogDescription>
              Add, view, or remove groups from the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Input
                placeholder="New group (e.g. 5Z)"
                value={newClass}
                onChange={e => setNewClass(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleAddClass}
                size="sm"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            
            <Separator className="my-4" />
            
            <div className="text-sm font-medium mb-2">Available groups</div>
            
            <div className="max-h-[300px] overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {availableClasses.sort().map(className => (
                  <div key={className} className="flex items-center justify-between rounded border p-2">
                    <span className="font-medium">{className}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleRemoveClass(className)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsManageClassesOpen(false)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}