export type NavigationKey = 'vehicles' | 'sell';

export type NavigationItem = {
  key?: NavigationKey;
  label: string;
  path: string;
};

// Shared by the desktop header nav, the compact menu and the footer so all list the same destinations.
export const siteNavigation: readonly NavigationItem[] = [
  { key: 'vehicles', label: 'Vehículos', path: '/vehiculos' },
  { key: 'sell', label: 'Vendé tu auto', path: '/vender' },
  { label: 'Servicios', path: '/#servicios' },
  { label: 'Nosotros', path: '/#nosotros' },
  { label: 'Preguntas', path: '/#preguntas' },
];
