/**
 * Compatibility shim — the prior light-variant `TopBar` has been superseded by
 * the dark sticky `AppHeader` (UX spec §14.3, S02-app-chrome). Existing call
 * sites importing `TopBar` continue to work unchanged; new code should import
 * `AppHeader` directly from `@/components/app-header`.
 */
export { AppHeader as TopBar } from '@/components/app-header';
export type { AppHeaderProps as TopBarProps } from '@/components/app-header';
