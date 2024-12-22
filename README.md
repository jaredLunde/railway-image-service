# Global Image Processing Service for [Railway](https://railway.com)

Upload, serve, and process images globally using railway.com. Includes on-the-fly image resizing, cropping, automatic AVIF/WebP, and more.

## Local development

### Quick start

See [Prerequisites](#prerequisites) for installing [mise](https://mise.jdx.dev/about.html) –
an all-in-one tool for managing project dependencies, environment variables, and running tasks.

```sh
# Setup the project
mise run setup

# Start the development server
# By default: https://localhost:3000
mise run
```

### Prerequisites

[mise](https://mise.jdx.dev/about.html) is used to run tasks and manage tool versions.

1. [Install mise](https://mise.jdx.dev/getting-started.html)

```sh
curl https://mise.run | sh
```

2. Add mise to your shell profile. This activates mise in your shell, ensuring the correct tool versions are used for your environment.

```sh
# Zsh
echo 'eval "$(~/.local/bin/mise activate zsh)"' >> ~/.zshrc
source ~/.zshrc

# Bash
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
source ~/.bashrc

# Fish
echo '~/.local/bin/mise activate fish | source' >> ~/.config/fish/config.fish
fish_add_path ~/.local/share/
```

3. Run `mise trust` to trust the project's `.mise.toml` file.
