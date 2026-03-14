import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
  mockGetProjects.mockResolvedValue([]);
  mockCreateProject.mockResolvedValue({ id: "new-proj-1" } as any);
});

describe("useAuth — initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("useAuth — signIn", () => {
  test("returns success result and navigates when credentials are valid", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([{ id: "proj-1" } as any]);

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("user@test.com", "password123");
    });

    expect(returnValue).toEqual({ success: true });
    expect(mockPush).toHaveBeenCalledWith("/proj-1");
  });

  test("sets isLoading to true during sign in and resets to false after", async () => {
    let resolveSignIn!: (v: any) => void;
    mockSignIn.mockReturnValue(new Promise((r) => (resolveSignIn = r)));

    const { result } = renderHook(() => useAuth());

    let promise: Promise<any>;
    act(() => {
      promise = result.current.signIn("user@test.com", "password123");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignIn({ success: false, error: "Invalid credentials" });
      await promise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("returns error result without navigating when credentials are invalid", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signIn("user@test.com", "wrongpass");
    });

    expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("resets isLoading to false even when signIn throws", async () => {
    mockSignIn.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "password123").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("passes email and password to the signIn action", async () => {
    mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("me@example.com", "securepass");
    });

    expect(mockSignIn).toHaveBeenCalledWith("me@example.com", "securepass");
  });
});

describe("useAuth — signUp", () => {
  test("returns success result and navigates when registration succeeds", async () => {
    mockSignUp.mockResolvedValue({ success: true });
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "brand-new" } as any);

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("new@test.com", "password123");
    });

    expect(returnValue).toEqual({ success: true });
    expect(mockPush).toHaveBeenCalledWith("/brand-new");
  });

  test("sets isLoading to true during sign up and resets to false after", async () => {
    let resolveSignUp!: (v: any) => void;
    mockSignUp.mockReturnValue(new Promise((r) => (resolveSignUp = r)));

    const { result } = renderHook(() => useAuth());

    let promise: Promise<any>;
    act(() => {
      promise = result.current.signUp("new@test.com", "password123");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignUp({ success: false, error: "Email already registered" });
      await promise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("returns error result without navigating when registration fails", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.signUp("existing@test.com", "password123");
    });

    expect(returnValue).toEqual({ success: false, error: "Email already registered" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  test("resets isLoading to false even when signUp throws", async () => {
    mockSignUp.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@test.com", "password123").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("passes email and password to the signUp action", async () => {
    mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new@example.com", "mypassword");
    });

    expect(mockSignUp).toHaveBeenCalledWith("new@example.com", "mypassword");
  });
});

describe("useAuth — handlePostSignIn with anonymous work", () => {
  test("saves anon work as a new project and navigates to it", async () => {
    const anonMessages = [{ role: "user", content: "hello" }];
    const anonFileSystem = { "/": { type: "directory" }, "/App.tsx": { type: "file" } };

    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: anonMessages,
      fileSystemData: anonFileSystem,
    });
    mockCreateProject.mockResolvedValue({ id: "anon-proj" } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "password123");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: anonMessages,
        data: anonFileSystem,
      })
    );
    expect(mockClearAnonWork).toHaveBeenCalled();
    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/anon-proj");
  });

  test("project name for anon work includes a time string", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: {},
    });
    mockCreateProject.mockResolvedValue({ id: "anon-proj" } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "password123");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.stringContaining("Design from") })
    );
  });

  test("ignores anon work data when messages array is empty", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([{ id: "existing-proj" } as any]);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "password123");
    });

    expect(mockCreateProject).not.toHaveBeenCalledWith(
      expect.objectContaining({ messages: [] })
    );
    expect(mockClearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-proj");
  });
});

describe("useAuth — handlePostSignIn without anonymous work", () => {
  test("navigates to the most recent existing project", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([
      { id: "recent-proj" } as any,
      { id: "older-proj" } as any,
    ]);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "password123");
    });

    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/recent-proj");
  });

  test("creates a new project when user has no existing projects", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "fresh-proj" } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "password123");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/fresh-proj");
  });

  test("new blank project name contains 'New Design'", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue(null);
    mockGetProjects.mockResolvedValue([]);
    mockCreateProject.mockResolvedValue({ id: "fresh-proj" } as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@test.com", "password123");
    });

    expect(mockCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.stringContaining("New Design") })
    );
  });
});
