import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  Divider,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input
} from '../components/ui';
import apiService from '../services/api';
import OpenstackStatusBadge from '../components/OpenstackStatusBadge';
import {
  Bell,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Search,
  Server,
  Settings,
  ShoppingCart,
  TrendingUp,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './DashboardLayout.css';

const ICON_MAP = {
  LayoutDashboard,
  Server,
  ShoppingCart,
  PlusCircle,
  Settings,
  CreditCard,
  Box,
  TrendingUp,
  Users,
  Cloud,
  Menu,
  Search,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
};

const CLIENT_SIDEBAR_ITEMS = [
  { label: 'Overview', path: '/client', icon: 'LayoutDashboard' },
  { label: 'Mes VMs', path: '/client/vms', icon: 'Server' },
  { label: 'Marketplace', path: '/client/marketplace', icon: 'ShoppingCart' },
  { label: 'Créer une VM', path: '/client/create', icon: 'PlusCircle' },
  { label: 'Paramètres', path: '/client/settings', icon: 'Settings' },
  { label: 'Facturation', path: '/client/billing', icon: 'CreditCard' },
];

const ADMIN_SIDEBAR_ITEMS = [
  { label: 'Overview', path: '/admin', icon: 'LayoutDashboard' },
  { label: 'VMs', path: '/admin/vms', icon: 'Server' },
  { label: 'Modèles VM', path: '/admin/vm-templates', icon: 'Box' },
  { label: 'Règle scale up', path: '/admin/scale-up-rule', icon: 'TrendingUp' },
  { label: 'Utilisateurs', path: '/admin/users', icon: 'Users' },
  { label: 'Facturation', path: '/admin/billing', icon: 'CreditCard' },
  { label: 'Paramètres', path: '/admin/settings', icon: 'Settings' },
];

const TITLE_MAP = {
  client: { '': ['Overview', 'VPS - VM Marketplace - Overview'], vms: ['Mes VMs', 'VPS - Mes machines'], marketplace: ['Marketplace', 'VPS - Offres'], create: ['Créer une VM', 'VPS - Nouvelle machine'], settings: ['Paramètres', 'VPS - Paramètres'], billing: ['Facturation', 'VPS - Facturation'] },
  admin: { '': ['Overview', 'Admin - VM Marketplace - Overview'], vms: ['VMs', 'Admin - Liste des VMs'], create: ['Créer une VM', 'Admin - Nouvelle machine'], 'vm-templates': ['Modèles VM', 'Admin - Modèles VM'], 'scale-up-rule': ['Règle scale up', 'Admin - Scale up'], users: ['Utilisateurs', 'Admin - Utilisateurs'], billing: ['Facturation', 'Admin - Facturation'], settings: ['Paramètres', 'Admin - Paramètres'] },
};

const SEGMENT_LABELS = {
  client: { '': 'Overview', vms: 'Mes VMs', marketplace: 'Marketplace', create: 'Créer une VM', settings: 'Paramètres', billing: 'Facturation' },
  admin: { '': 'Overview', vms: 'VMs', create: 'Créer une VM', 'vm-templates': 'Modèles VM', 'scale-up-rule': 'Règle scale up', users: 'Utilisateurs', billing: 'Facturation', settings: 'Paramètres' },
};

const SEARCH_RESULTS_MAX = 8;

function filterVmsByQuery(servers, query) {
  if (!Array.isArray(servers) || !query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  return servers.filter((s) => {
    const name = (s.name || '').toLowerCase();
    const id = (s.id || '').toLowerCase();
    const dbId = String(s.dbId || '').toLowerCase();
    return name.includes(q) || id.includes(q) || dbId.includes(q);
  }).slice(0, SEARCH_RESULTS_MAX);
}

export default function DashboardLayout({ type = 'client' }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchCacheRef = useRef(null);
  const searchWrapRef = useRef(null);

  const basePath = type === 'client' ? '/client' : '/admin';
  const pathSuffix = location.pathname.replace(basePath, '') || '';
  const segment = pathSuffix.replace(/^\//, '') || '';
  const map = TITLE_MAP[type] || TITLE_MAP.client;
  const segLabels = SEGMENT_LABELS[type] || SEGMENT_LABELS.client;
  const [title, subtitle] = map[segment] || map[''] || ['Overview', 'VM Marketplace'];
  const breadcrumbItems = [{ path: basePath, label: segLabels[''] || 'Overview' }];
  if (segment) breadcrumbItems.push({ path: `${basePath}/${segment}`, label: segLabels[segment] || segment });

  const sidebarItems = type === 'admin' ? ADMIN_SIDEBAR_ITEMS : CLIENT_SIDEBAR_ITEMS;

  const isActive = (path) => {
    if (path === '/client' || path === '/admin') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const userWrapRef = useRef(null);
  const notifWrapRef = useRef(null);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const close = (e) => {
      if (userWrapRef.current && !userWrapRef.current.contains(e.target)) setUserMenuOpen(false);
      if (notifWrapRef.current && !notifWrapRef.current.contains(e.target)) setNotifOpen(false);
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await apiService.getNotifications();
      setNotifications(res.notifications || []);
      setNotifUnreadCount(res.unreadCount ?? 0);
    } catch {
      setNotifications([]);
      setNotifUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (notifOpen) loadNotifications();
  }, [notifOpen, loadNotifications]);

  useEffect(() => {
    const interval = setInterval(loadNotifications, 45000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkNotifRead = async (id) => {
    try {
      await apiService.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
      setNotifUnreadCount((c) => Math.max(0, c - 1));
    } catch (_) {}
  };

  const loadSearchCache = useCallback(async () => {
    if (searchCacheRef.current) return;
    setSearchLoading(true);
    try {
      const data = type === 'admin' ? await apiService.getAdminVms() : await apiService.getVms();
      const list = data.servers || [];
      searchCacheRef.current = list;
    } catch {
      searchCacheRef.current = [];
    } finally {
      setSearchLoading(false);
    }
  }, [type]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    if (searchCacheRef.current) {
      setSearchResults(filterVmsByQuery(searchCacheRef.current, searchQuery));
      setSearchOpen(true);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!searchLoading && searchQuery.trim() && searchCacheRef.current) {
      setSearchResults(filterVmsByQuery(searchCacheRef.current, searchQuery));
      setSearchOpen(true);
    }
  }, [searchLoading, searchQuery]);

  return (
    <div className="dl-shell" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', minHeight: '100vh' }}>
      {isMobile && mobileSidebarOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            zIndex: 40
          }}
        />
      )}
      <aside
        className="dl-sidebar"
        style={{
          borderRight: isMobile ? 'none' : '1px solid #e2e8f0',
          padding: '1rem',
          position: isMobile ? 'fixed' : 'sticky',
          top: 0,
          left: 0,
          width: 300,
          height: '100vh',
          zIndex: 50,
          // Fallback visuel si le CSS du layout n'est pas chargé.
          background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)',
          transform: isMobile ? (mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          transition: 'transform 0.2s ease'
        }}
      >
        <Card
          shadow="none"
          radius="sm"
          className="dl-sidebar-card"
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <CardBody style={{ gap: '1rem' }}>
            <Link to={type === 'client' ? '/client' : '/admin'} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', textDecoration: 'none', color: '#e2e8f0', fontWeight: 700 }}>
              <Cloud size={20} />
              VM Marketplace
            </Link>
            <Divider />
            <nav style={{ display: 'grid', gap: '.35rem' }}>
              {sidebarItems.map((item) => {
                const IconComp = ICON_MAP[item.icon] || Settings;
                const active = !item.external && isActive(item.path);
                if (item.external) {
                  return (
                    <a key={item.path} href={item.path} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <Button fullWidth variant="light" startContent={<IconComp size={16} />} style={{ justifyContent: 'flex-start', color: '#cbd5e1' }} onPress={() => setMobileSidebarOpen(false)}>
                        {item.label}
                      </Button>
                    </a>
                  );
                }
                return (
                  <Link key={item.path} to={item.path} style={{ textDecoration: 'none' }} onClick={() => setMobileSidebarOpen(false)}>
                    <Button
                      fullWidth
                      color={active ? 'primary' : 'default'}
                      variant={active ? 'solid' : 'light'}
                      startContent={<IconComp size={16} />}
                      style={{ justifyContent: 'flex-start', color: active ? '#fff' : '#cbd5e1', background: active ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'transparent' }}
                    >
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
            <Divider />
            <OpenstackStatusBadge />
            <Button color="danger" variant="light" startContent={<LogOut size={16} />} onClick={logout}>
              Déconnexion
            </Button>
          </CardBody>
        </Card>
      </aside>

      <main style={{ padding: isMobile ? '0.75rem' : '1.1rem 1.4rem' }}>
        <Card
          shadow="none"
          radius="sm"
          className="dl-topbar-card"
          style={{
            marginBottom: '1rem',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <CardBody style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: '1rem', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem' }}>
                <div className="dl-breadcrumb">
                  {breadcrumbItems.map((item, i) => (
                    <span key={item.path}>
                      {i > 0 && ' / '}
                      {i === breadcrumbItems.length - 1 ? item.label : <Link to={item.path} style={{ color: '#4f46e5' }}>{item.label}</Link>}
                    </span>
                  ))}
                </div>
                {isMobile && (
                  <Button isIconOnly variant="flat" aria-label="Ouvrir le menu" onPress={() => setMobileSidebarOpen((v) => !v)}>
                    <Menu size={18} />
                  </Button>
                )}
              </div>
              <h2 className="dl-top-title">{title}</h2>
              <p className="dl-top-subtitle">{subtitle}</p>
            </div>

            <div ref={searchWrapRef} style={{ minWidth: isMobile ? 'auto' : 320, width: '100%', position: 'relative' }}>
              <Input
                startContent={<Search size={16} />}
                placeholder="Rechercher une VM..."
                value={searchQuery}
                onFocus={() => {
                  loadSearchCache();
                  if (searchQuery.trim()) setSearchOpen(true);
                }}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchOpen && searchQuery.trim() && (
                <Card style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 30, border: '1px solid #dbe3f2', background: '#fff' }}>
                  <CardBody style={{ maxHeight: 260, overflow: 'auto', gap: '.35rem' }}>
                    {searchLoading ? (
                      <span style={{ color: '#64748b' }}>Chargement...</span>
                    ) : searchResults.length === 0 ? (
                      <span style={{ color: '#64748b' }}>Aucune VM trouvée</span>
                    ) : (
                      searchResults.map((vm) => (
                        <Link
                          key={vm.id || vm.dbId}
                          to={`${basePath}/vms/${vm.id}`}
                          onClick={() => {
                            setSearchQuery('');
                            setSearchOpen(false);
                          }}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: '#0f172a', padding: '.35rem .2rem' }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}>
                            <Server size={14} />
                            {vm.name || vm.id}
                          </span>
                          <Badge color={vm.status === 'ACTIVE' ? 'success' : 'default'} variant="flat" size="sm">
                            {vm.status || 'N/A'}
                          </Badge>
                        </Link>
                      ))
                    )}
                  </CardBody>
                </Card>
              )}
            </div>

            <div className="dl-topbar-actions" style={{ justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
              <OpenstackStatusBadge />
              <div ref={notifWrapRef}>
                <Dropdown isOpen={notifOpen} onOpenChange={setNotifOpen}>
                  <DropdownTrigger>
                    <Button isIconOnly variant="light" aria-label="Notifications">
                      <Badge content={notifUnreadCount > 0 ? (notifUnreadCount > 99 ? '99+' : notifUnreadCount) : null} color="danger">
                        <Bell size={18} />
                      </Badge>
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Notifications" disabledKeys={[]}>
                    {notifications.length === 0 && (
                      <DropdownItem key="empty">Aucune notification</DropdownItem>
                    )}
                    {notifications.map((n) => (
                      <DropdownItem key={n.id} onPress={() => handleMarkNotifRead(n.id)}>
                        {n.title}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
              </div>
              <div ref={userWrapRef}>
                <Dropdown isOpen={userMenuOpen} onOpenChange={setUserMenuOpen}>
                  <DropdownTrigger>
                    <Button variant="light" startContent={<Avatar size="sm" name={user?.name?.[0] || user?.email?.[0] || '?'} />}>
                      {user?.name || user?.email || 'User'}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="User menu">
                    <DropdownItem key="settings">
                      <Link to={type === 'client' ? '/client/settings' : '/admin/settings'} style={{ textDecoration: 'none', color: 'inherit' }}>Paramètres</Link>
                    </DropdownItem>
                    <DropdownItem key="logout" className="text-danger" color="danger" onPress={logout}>
                      Déconnexion
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>
          </CardBody>
        </Card>
        <div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
