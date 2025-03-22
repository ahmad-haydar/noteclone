import { useState, useEffect, useCallback, useRef } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import type { Block } from "@blocknote/core";
import { FiPlus, FiMenu, FiTrash2, FiFileText } from "react-icons/fi";
import { Geist, Geist_Mono } from "next/font/google";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Define the Page type with proper structure
type Page = {
  id: string; // Acts as UUID
  title: string;
  content: Block[];
};

// Editor component that reinitializes when content changes
function Editor({
  content,
  onContentChange,
}: {
  content: Block[];
  onContentChange: (content: Block[]) => void;
}) {
  // Create new editor instance with the content
  const editor = useCreateBlockNote({
    // Provide default empty content if content is undefined or empty
    initialContent: Array.isArray(content) && content.length > 0 ? content : undefined,
  });

  // Handle editor content changes
  useEffect(() => {
    if (!editor) return;

    const handleContentChange = () => {
      const updatedContent = editor.topLevelBlocks;
      onContentChange(updatedContent);
    };

    // Subscribe to editor changes
    const unsubscribe = editor?.onChange?.(handleContentChange) || (() => {});

    return () => {
      unsubscribe();
    };
  }, [editor, onContentChange]);

  return <BlockNoteView editor={editor} theme="light" />;
}

const STORAGE_KEY = "notion_clone_pages";

export default function NotionClone() {
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Get current page
  const currentPage = pages.find((page) => page.id === currentPageId);

  // Track if content is loading to prevent update loops
  const isLoading = useRef(false);

  // Function to save all pages to localStorage
  const saveToLocalStorage = useCallback((pagesToSave: Page[]) => {
    if (pagesToSave.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pagesToSave));
    }
  }, []);

  // Load data from localStorage on initial render
  useEffect(() => {
    const savedPages = localStorage.getItem(STORAGE_KEY);
    if (savedPages) {
      try {
        const parsedPages = JSON.parse(savedPages) as Page[];
        if (Array.isArray(parsedPages) && parsedPages.length > 0) {
          // Ensure all pages have the expected structure
          const validatedPages = parsedPages.map((page) => ({
            id: page.id || Date.now().toString(),
            title: page.title || "Untitled",
            content: Array.isArray(page.content) ? page.content : [],
          }));

          setPages(validatedPages);
          setCurrentPageId(validatedPages[0].id);
          return;
        }
      } catch (e) {
        console.error("Failed to parse saved pages", e);
      }
    }

    // If no saved data or error parsing, create a default page
    const newPage = createNewPage("Getting Started");
    setPages([newPage]);
    setCurrentPageId(newPage.id);
  }, []);

  // Save data to localStorage when pages change
  useEffect(() => {
    saveToLocalStorage(pages);
  }, [pages, saveToLocalStorage]);

  // Handle editor content update
  const handleEditorContentChange = useCallback(
    (updatedContent: Block[]) => {
      if (!currentPageId || isLoading.current) return;

      setPages((prevPages) =>
        prevPages.map((page) =>
          page.id === currentPageId
            ? { ...page, content: updatedContent }
            : page
        )
      );
    },
    [currentPageId]
  );

  // Save data when window loses focus or before unload
  useEffect(() => {
    const saveCurrentPage = () => {
      if (currentPageId && !isLoading.current) {
        saveToLocalStorage(pages);
      }
    };

    window.addEventListener("blur", saveCurrentPage);
    window.addEventListener("beforeunload", saveCurrentPage);

    return () => {
      window.removeEventListener("blur", saveCurrentPage);
      window.removeEventListener("beforeunload", saveCurrentPage);
    };
  }, [currentPageId, pages, saveToLocalStorage]);

  // Initialize with mobile check
  useEffect(() => {
    // Check if we're on mobile
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  // Create a new page with proper structure
  const createNewPage = (title: string): Page => {
    return {
      id: Date.now().toString(),
      title: title || "Untitled",
      content: [], // BlockNote will initialize with default content
    };
  };

  // Add a new page
  const addNewPage = () => {
    const newPage = createNewPage("Untitled");
    setPages((prevPages) => [...prevPages, newPage]);

    // Switch to the new page
    setCurrentPageId(newPage.id);

    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Delete a page
  const deletePage = (pageId: string) => {
    // Make sure we're not in the process of typing
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const updatedPages = pages.filter((page) => page.id !== pageId);
    setPages(updatedPages);
    saveToLocalStorage(updatedPages);

    if (currentPageId === pageId) {
      setCurrentPageId(updatedPages.length > 0 ? updatedPages[0].id : null);
    }
  };

  // Update page title
  const updatePageTitle = (pageId: string, newTitle: string) => {
    if (!pageId) return;

    setPages((prevPages) => {
      return prevPages.map((page) =>
        page.id === pageId ? { ...page, title: newTitle || "Untitled" } : page
      );
    });
  };

  // Handle title change on blur
  const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (currentPageId) {
      updatePageTitle(currentPageId, e.target.value || "Untitled");
    }
  };

  // Handle title change on Enter key
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  // Handle switching to a different page
  const handlePageSwitch = (pageId: string) => {
    // Don't do anything if it's the same page
    if (pageId === currentPageId) return;

    // Save current content before switching pages
    if (currentPageId && !isLoading.current) {
      const updatedContent =
        pages.find((page) => page.id === currentPageId)?.content || [];

      setPages((prevPages) => {
        const updatedPages = prevPages.map((page) =>
          page.id === currentPageId
            ? { ...page, content: updatedContent }
            : page
        );

        // Save to localStorage after updating
        saveToLocalStorage(updatedPages);

        return updatedPages;
      });
    }

    // Switch to the new page
    setCurrentPageId(pageId);

    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
      <div className="h-screen flex flex-col bg-white text-gray-800">
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside
            className={`w-60 flex-shrink-0 flex flex-col bg-[#fbfbfa] border-r border-[#e6e6e6] transition-all duration-300 ease-in-out ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            } ${isMobile ? "absolute z-10 h-full" : "relative"}`}
          >
            {/* Sidebar header */}
            <div className="p-3 flex items-center justify-between border-b border-[#e6e6e6]">
              <h1 className="font-bold text-base">Notion Clone</h1>
            </div>

            {/* Pages section */}
            <div className="p-2 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-2 px-2">
                <h2 className="text-sm text-gray-500 font-medium">Pages</h2>
                <button
                  onClick={addNewPage}
                  className="p-1 rounded hover:bg-gray-100 text-gray-500"
                  title="Add new page"
                >
                  <FiPlus size={16} />
                </button>
              </div>

              <div className="space-y-0.5">
                {pages.map((page) => (
                  <div
                    key={page.id}
                    className={`flex items-center group rounded ${
                      currentPageId === page.id
                        ? "bg-gray-100"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    <button
                      onClick={() => handlePageSwitch(page.id)}
                      className="flex-1 p-1 px-2 text-left flex items-center text-sm text-gray-600"
                    >
                      <FiFileText className="mr-2 text-gray-500" size={16} />
                      <span className="truncate">
                        {page.title || "Untitled"}
                      </span>
                    </button>
                    <div className="opacity-0 group-hover:opacity-100 pr-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePage(page.id);
                        }}
                        className="p-1 rounded hover:bg-gray-200 text-gray-500"
                        title="Delete page"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 flex flex-col overflow-hidden bg-white">
            {currentPage ? (
              <>
                {/* Top page header */}
                <header className="h-12 flex items-center px-3 border-b border-[#e6e6e6]">
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-2 rounded hover:bg-gray-100 text-gray-500 mr-3"
                  >
                    <FiMenu size={16} />
                  </button>
                  <span className="text-sm font-medium">
                    {currentPage.title}
                  </span>
                </header>

                {/* Page content */}
                <div className="flex-1 overflow-auto">
                  <div className="max-w-3xl mx-auto p-4 pt-8">
                    {/* Page title */}
                    <div className="mb-8">
                      <input
                        type="text"
                        value={currentPage.title}
                        onChange={(e) =>
                          updatePageTitle(currentPage.id, e.target.value)
                        }
                        onBlur={handleTitleBlur}
                        onKeyDown={handleTitleKeyDown}
                        className="text-4xl font-bold w-full focus:outline-none mb-4"
                        placeholder="Untitled"
                      />
                      <div className="flex items-center text-yellow-500 mb-4">
                        <span className="text-lg mr-2">👋</span>
                        <p className="text-gray-700">
                          Welcome! Get your team started.
                        </p>
                      </div>
                    </div>

                    {/* Editor */}
                    {currentPage && currentPageId && (
                      <Editor
                        key={currentPageId}
                        content={currentPage.content}
                        onContentChange={handleEditorContentChange}
                      />
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <p>No page selected</p>
                <button
                  onClick={addNewPage}
                  className="mt-2 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                >
                  Create a new page
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
