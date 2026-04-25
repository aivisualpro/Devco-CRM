"use client";


import React, { useImperativeHandle, forwardRef } from 'react';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import { 
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, ImageIcon, 
  List, ListOrdered, Heading, AlignLeft, AlignCenter, AlignRight, Table as TableIcon
} from 'lucide-react';
import { useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  hideToolbar?: boolean;
}

export const RichTextEditor = forwardRef(({ value, onChange, placeholder, readOnly, hideToolbar }: RichTextEditorProps, ref) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({
        placeholder: placeholder || 'Type something...',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[150px]',
      },
    },
  });

  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
  }));

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-border rounded-md overflow-hidden flex flex-col bg-background">
      {(!readOnly && !hideToolbar) && (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/50">
          <button
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          className={`p-1.5 rounded hover:bg-muted ${editor.isActive('bold') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
          type="button"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          className={`p-1.5 rounded hover:bg-muted ${editor.isActive('italic') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
          type="button"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
          className={`p-1.5 rounded hover:bg-muted ${editor.isActive('underline') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
          type="button"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-border mx-1" />
        <button
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
          className={`p-1.5 rounded hover:bg-muted ${editor.isActive('heading', { level: 2 }) ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
          type="button"
        >
          <Heading className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-border mx-1" />
        <button
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
          className={`p-1.5 rounded hover:bg-muted ${editor.isActive('bulletList') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
          type="button"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
          className={`p-1.5 rounded hover:bg-muted ${editor.isActive('orderedList') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
          type="button"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-border mx-1" />
        <button
          onClick={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('left').run(); }}
          className={`p-1.5 rounded hover:bg-muted ${editor.isActive({ textAlign: 'left' }) ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
          type="button"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('center').run(); }}
          className={`p-1.5 rounded hover:bg-muted ${editor.isActive({ textAlign: 'center' }) ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
          type="button"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('right').run(); }}
          className={`p-1.5 rounded hover:bg-muted ${editor.isActive({ textAlign: 'right' }) ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
          type="button"
        >
          <AlignRight className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-border mx-1" />
        <button
          onClick={(e) => {
            e.preventDefault();
            const url = window.prompt('URL');
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          className={`p-1.5 rounded hover:bg-muted ${editor.isActive('link') ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
          type="button"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            const url = window.prompt('Image URL');
            if (url) {
              editor.chain().focus().setImage({ src: url }).run();
            }
          }}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground"
          type="button"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); }}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground"
          type="button"
        >
          <TableIcon className="w-4 h-4" />
        </button>
      </div>
      )}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
