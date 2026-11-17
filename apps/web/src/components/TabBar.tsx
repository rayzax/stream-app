import { NavLink } from 'react-router-dom';
import { GlobeIcon, TvIcon, FilmIcon } from './icons';

const TABS = [
  { to: '/', label: 'Sports', Icon: GlobeIcon },
  { to: '/tv', label: 'Live TV', Icon: TvIcon },
  { to: '/stream', label: 'Stream', Icon: FilmIcon },
];

export default function TabBar() {
  return (
    <nav className="tabbar">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} end viewTransition>
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
