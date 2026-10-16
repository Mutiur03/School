# tinystruct Architecture and Configuration

## When to Use

Choose **tinystruct** when you need a lightweight, high-performance Java framework that treats CLI and HTTP as equal citizens. Ideal for microservices, CLI utilities, and data-driven applications with a small footprint and zero-dependency JSON handling.

## How It Works

### Core Architecture

The framework operates on a singleton `ActionRegistry` that maps URL patterns (or command strings) to `Action` objects. When a request arrives, the system resolves the path and invokes the corresponding method handle.

#### Key Abstractions

| Class/Interface       | Role                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `AbstractApplication` | Base class for all tinystruct applications. Extend this.                                           |
| `@Action` annotation  | Maps a method to a URI path (web) or command name (CLI). The single routing primitive.             |
| `ActionRegistry`      | Singleton that maps URL patterns to `Action` objects via regex. Never instantiate directly.        |
| `Action`              | Wraps a `MethodHandle` + regex pattern + priority + `Mode` for dispatch.                           |
| `Context`             | Per-request state store. Access via `getContext()`. Holds CLI args and HTTP request/response.      |
| `Dispatcher`          | CLI entry point (`bin/dispatcher`). Reads `--import` to load applications.                         |
| `HttpServer`          | Built-in HTTP server. Start with `bin/dispatcher start --import org.tinystruct.system.HttpServer`. |

### Package Map

```
org.tinystruct/
├── AbstractApplication.java      ← extend this
├── Application.java              ← interface
├── ApplicationException.java     ← checked exception
├── ApplicationRuntimeException.java ← unchecked exception
├── application/
│   ├── Action.java               ← runtime action wrapper
│   ├── ActionRegistry.java       ← singleton route registry
│   └── Context.java              ← request context
├── system/
│   ├── annotation/Action.java    ← @Action annotation + Mode enum
│   ├── Dispatcher.java           ← CLI dispatcher
│   ├── HttpServer.java           ← built-in HTTP server
│   ├── EventDispatcher.java      ← event bus
│   └── Settings.java             ← reads application.properties
├── data/
│   ├── component/Builder.java    ← JSON object (use instead of Gson/Jackson)
│   ├── component/Builders.java   ← JSON array
│   ├── component/AbstractData.java ← base POJO for DB persistence
│   ├── component/Condition.java  ← fluent SQL query builder
│   ├── component/FieldType.java  ← SQL-to-Java type mappings
│   ├── Mapping.java              ← reads .map.xml metadata
│   ├── DatabaseOperator.java     ← low-level JDBC wrapper
│   └── FileEntity.java           ← file upload representation
├── http/                         ← Request, Response, Constants
│   └── SSEPushManager.java       ← Server-Sent Events management
└── net/                          ← URLRequest, HTTPHandler (outbound HTTP)
```

### Template Behavior and Dispatch Flow

By default, the framework assumes a view template is required. If `templateRequired` is `true`, `toString()` looks for a `.view` file in `src/main/resources/themes/<ClassName>.view`. Use `setVariable("name", value)` to pass data to templates, which use `{%name%}` for interpolation.

## Examples

### Minimal Application Initialization

```java
@Override
public void init() {
    this.setTemplateRequired(false); // Skip .view template lookup for data-only apps
    // Do NOT call setAction() here — use @Action annotation instead
}
```

### Action Definition and CLI Invocation

```java
@Action("hello")
public String hello() {
    return "Hello, tinystruct!";
}
```

**Execution via Dispatcher:**

```bash
bin/dispatcher hello
bin/dispatcher greet/James
bin/dispatcher echo --words "Hello" --import com.example.HelloApp
```

### Configuration Access

Located at `src/main/resources/application.properties`:

```java
String port = this.getConfiguration("server.port");
```
