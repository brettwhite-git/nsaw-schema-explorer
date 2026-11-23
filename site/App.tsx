import { Shell } from './Shell';
import { useRoute } from './router';
import { Home } from './pages/Home';
import { CoursePage } from './pages/Course';
import { AtlasHome, IndexStub, NotFound } from './pages/Stubs';
import { EntityPage } from './pages/Entity';
import { useEffect } from 'react';

const TITLES: Record<string, string> = { home: 'The Warehouse, Drawn', atlas: 'The Atlas - The Warehouse, Drawn', index: 'The Index - The Warehouse, Drawn' };

export function App() {
  const route = useRoute();
  useEffect(() => { if (TITLES[route.name]) document.title = TITLES[route.name]; }, [route.name]);
  let page;
  switch (route.name) {
    case 'home': page = <Home />; break;
    case 'course': page = <CoursePage chapterId={route.chapterId} />; break;
    case 'atlas': page = <AtlasHome />; break;
    case 'entity': page = <EntityPage type={route.type} entityKey={route.key} />; break;
    case 'index': page = <IndexStub />; break;
    default: page = <NotFound path={route.path} />;
  }
  return <Shell>{page}</Shell>;
}
