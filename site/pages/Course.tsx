import { useEffect, useState } from 'react';
import type { ChapterContent } from '../../content/types';
import { Chapter } from '../Chapter';
import { loadChapter, CHAPTERS } from '../chapters';
import { Link } from '../router';
import { NotFound } from './Stubs';

export function CoursePage({ chapterId }: { chapterId: string }) {
  const [state, setState] = useState<{ id: string; content?: ChapterContent; done: boolean }>({ id: chapterId, done: false });
  useEffect(() => {
    let live = true;
    setState({ id: chapterId, done: false });
    loadChapter(chapterId).then((content) => live && setState({ id: chapterId, content, done: true }), () => live && setState({ id: chapterId, done: true }));
    return () => { live = false; };
  }, [chapterId]);

  if (!state.done || state.id !== chapterId) return <p className="mono-cap faint" aria-busy="true">loading the chapter...</p>;
  if (state.content) return <Chapter content={state.content} />;
  const known = CHAPTERS.find((c) => c.id === chapterId);
  if (known) {
    return (
      <>
        <header className="page-head">
          <p className="label-row">CH. {String(known.number).padStart(2, '0')} <i /> NOT YET DRAWN</p>
          <h1 className="title">{known.title}</h1>
          <p className="dek">{known.blurb}</p>
        </header>
        <p>This chapter is planned but not drawn yet. <Link to="/">Back to the contents.</Link></p>
      </>
    );
  }
  return <NotFound path={`/course/${chapterId}`} />;
}
