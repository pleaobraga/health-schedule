export interface RouteItemConfig {
  path: string;
  label: string;
  adminOnly?: boolean;
}

/**
 * Route metadata mapping for inspection and extensibility.
 */
export const routeConfig: RouteItemConfig[] = [
  { path: '/login', label: 'Autenticação' },
  { path: '/', label: 'Calendário de Escalas' },
  { path: '/calendario', label: 'Calendário de Escalas (Alias)' },
  { path: '/compras', label: 'Compras e Gastos' },
  { path: '/pessoas', label: 'Gerenciar Pessoas' },
  { path: '/turnos', label: 'Turnos de Trabalho' },
  { path: '/regras', label: 'Regras de Validação' },
  { path: '/enderecos', label: 'Gerenciar Endereços' },
  { path: '/importar', label: 'Importar Dados' },
  { path: '/configuracoes', label: 'Configurações Gerais' },
  { path: '/usuarios', label: 'Gestão de Usuários', adminOnly: true },
]
