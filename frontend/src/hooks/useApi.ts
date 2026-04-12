import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// ==================== Projects ====================

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await axios.get('/api/projects');
      return data.data.projects;
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: any) => {
      const { data } = await axios.post('/api/projects', formData);
      return data.data.project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ==================== Patterns ====================

export function usePatterns() {
  return useQuery({
    queryKey: ['patterns'],
    queryFn: async () => {
      const { data } = await axios.get('/api/patterns');
      return data.data.patterns;
    },
  });
}

export function useCreatePattern() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: any) => {
      const { data } = await axios.post('/api/patterns', formData);
      return data.data.pattern;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patterns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdatePattern() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
      const { data } = await axios.put(`/api/patterns/${id}`, formData);
      return data.data.pattern;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patterns'] });
    },
  });
}

export function useDeletePattern() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/patterns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patterns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ==================== Yarn ====================

export function useYarn() {
  return useQuery({
    queryKey: ['yarn'],
    queryFn: async () => {
      const { data } = await axios.get('/api/yarn');
      return data.data.yarn;
    },
  });
}

export function useCreateYarn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: any) => {
      const { data } = await axios.post('/api/yarn', formData);
      return data.data.yarn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yarn'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateYarn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
      const { data } = await axios.put(`/api/yarn/${id}`, formData);
      return data.data.yarn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yarn'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteYarn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/yarn/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yarn'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ==================== Tools ====================

export function useTools() {
  return useQuery({
    queryKey: ['tools'],
    queryFn: async () => {
      const { data } = await axios.get('/api/tools');
      return data.data.tools;
    },
  });
}

export function useCreateTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: any) => {
      const { data } = await axios.post('/api/tools', formData);
      return data.data.tool;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
    },
  });
}

export function useUpdateTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
      const { data } = await axios.put(`/api/tools/${id}`, formData);
      return data.data.tool;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
    },
  });
}

export function useDeleteTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/tools/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
    },
  });
}

// ==================== Recipients ====================

export function useRecipients() {
  return useQuery({
    queryKey: ['recipients'],
    queryFn: async () => {
      const { data } = await axios.get('/api/recipients');
      return data.data.recipients;
    },
  });
}

export function useCreateRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: any) => {
      const { data } = await axios.post('/api/recipients', formData);
      return data.data.recipient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
      const { data } = await axios.put(`/api/recipients/${id}`, formData);
      return data.data.recipient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
    },
  });
}

export function useDeleteRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/recipients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ==================== Dashboard ====================

interface DashboardData {
  stats: {
    name: string;
    value: string;
    iconName: string;
    href: string;
    color: string;
  }[];
  recentProjects: any[];
  lowStockYarn: any[];
}

export function useDashboardStats() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [projectsRes, patternsRes, yarnRes, recipientsRes, recentProjectsRes] =
        await Promise.all([
          axios.get('/api/projects/stats'),
          axios.get('/api/patterns/stats'),
          axios.get('/api/yarn/stats'),
          axios.get('/api/recipients/stats'),
          axios.get('/api/projects?limit=5'),
        ]);

      const stats = [
        {
          name: 'Active Projects',
          value: String(projectsRes.data.data.stats.active_count || 0),
          iconName: 'FiFolder',
          href: '/projects',
          color: 'bg-purple-500',
        },
        {
          name: 'Patterns',
          value: String(patternsRes.data.data.stats.total_count || 0),
          iconName: 'FiBook',
          href: '/patterns',
          color: 'bg-blue-500',
        },
        {
          name: 'Yarn Skeins',
          value: String(yarnRes.data.data.stats.total_skeins || 0),
          iconName: 'FiPackage',
          href: '/yarn',
          color: 'bg-green-500',
        },
        {
          name: 'Recipients',
          value: String(recipientsRes.data.data.stats.total_count || 0),
          iconName: 'FiUsers',
          href: '/recipients',
          color: 'bg-orange-500',
        },
      ];

      const recentProjects = recentProjectsRes.data.data.projects || [];

      // Fetch low-stock yarn
      let lowStockYarn: any[] = [];
      try {
        const lowStockRes = await axios.get('/api/yarn?limit=100');
        const allYarn = lowStockRes.data.data.yarn || [];
        lowStockYarn = allYarn.filter((y: any) => {
          if (!y.low_stock_alert || !y.low_stock_threshold) return false;
          return (y.yards_remaining || 0) <= y.low_stock_threshold;
        });
      } catch {
        // Non-critical
      }

      return { stats, recentProjects, lowStockYarn };
    },
  });
}
