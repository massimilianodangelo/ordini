import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Query key for the groups endpoints
const CLASSES_QUERY_KEY = ['/api/admin/groups'];

// List of default groups (generic for any organization)
const defaultClasses = [
  "Team A", "Team B", "Team C", "Team D",
  "Group 1", "Group 2", "Group 3", "Group 4",
  "Department Alpha", "Department Beta", "Department Gamma",
  "Office 1", "Office 2", "Office 3"
];

/**
 * Custom hook to manage the list of classes
 * Centralizes the logic to retrieve and update classes throughout the app
 */
export function useClasses() {
  const queryClient = useQueryClient();

  // Function to retrieve groups
  async function fetchClasses() {
    try {
      const response = await fetch('/api/admin/groups');
      if (!response.ok) {
        throw new Error('Error fetching groups');
      }
      return await response.json() as string[];
    } catch (err) {
      console.error('Error fetching groups:', err);
      
      // Fallback to localStorage
      const cachedClasses = localStorage.getItem('availableClasses');
      if (cachedClasses) {
        return JSON.parse(cachedClasses) as string[];
      }
      
      // If there are no saved classes, use the default ones
      return defaultClasses;
    }
  }

  // Query to get the list of available classes
  const { data: classes = [], isLoading, error } = useQuery({
    queryKey: CLASSES_QUERY_KEY,
    queryFn: fetchClasses,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Callback to update the list of groups throughout the app
  const updateClasses = useCallback(async (newClasses: string[]) => {
    try {
      // Send the update to the server
      await fetch('/api/admin/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ classes: newClasses }),
      });
      
      // Update the React Query cache
      queryClient.setQueryData(CLASSES_QUERY_KEY, newClasses);
      
      // Store in localStorage as fallback
      localStorage.setItem('availableClasses', JSON.stringify(newClasses));
      
      return true;
    } catch (error) {
      console.error('Error updating groups:', error);
      return false;
    }
  }, [queryClient]);

  return {
    classes: Array.isArray(classes) ? [...classes].sort() : [],
    isLoading,
    error,
    updateClasses,
  };
}