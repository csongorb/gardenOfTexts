# Garden of Texts

A garden of texts. For you to *observe, water, and cut*.

You can **[plant your first garden](https://csongorb.github.io/gardenOfTexts/)**.  
Or **[send a garden as a present](https://csongorb.github.io/gardenOfTexts/?text=Send&text=a+garden&text=as+a+present)**.

## How to play

| | Mouse / Keyboard | Touch |
|---|---|---|
| **Water** | hover | touch and hold / move |
| **Cut** | left click | tap and release |
| **Switch mode** | right click | bottom left |
| **Change circle size** | mouse wheel | pinch |
| **Fullscreen** | `F` | – |

## Send a garden

Write your own text into the link:

https://csongorb.github.io/gardenOfTexts/?text=Happy&text=Birthday

- `?` starts the text, `&` adds the next line
- spaces in the text can be written as `+` or `%20` (`text=a+garden`)

Each `text=` is one line: `text=word,size,x,y`

- `0,0` is the center of the screen
- use `rnd` for size or positions
- a line without a position is placed below the line above

A link with a new text starts a new garden.

Examples:

- [Three centered lines](https://csongorb.github.io/gardenOfTexts/?text=Garden,100&text=of,80&text=Texts,100): `?text=Garden,100&text=of,80&text=Texts,100`
- [A block in the upper left, and a word in the lower right](https://csongorb.github.io/gardenOfTexts/?text=Hello,100,-150,-150&text=World,80&text=Garden,120,100,150): `?text=Hello,100,-150,-150&text=World,80&text=Garden,120,100,150`
- [Everything random](https://csongorb.github.io/gardenOfTexts/?text=Hello,rnd,rnd,rnd&text=World,rnd,rnd,rnd): `?text=Hello,rnd,rnd,rnd&text=World,rnd,rnd,rnd`

## Documentation

- Read the [Journal](Journal/journal.md) for reflections on the design and development process
- Read the [Manifesto](Journal/manifesto.md) for the bigger picture, what this project tries to achieve
- Read the [Todos](Journal/todos.md) for a list of upcoming tasks
- Read the [Commit History](https://github.com/csongorb/gardenOfTexts/commits/master/) for step-by-step information about how the project was built

## Credits

Csongor Baranyai  
[csongorb.com](https://csongorb.com)

Made with [p5.js](https://p5js.org)

## License

[![Creative Commons License](https://i.creativecommons.org/l/by-nc/4.0/88x31.png)](http://creativecommons.org/licenses/by-nc/4.0/)  
This work is licensed under a [Creative Commons Attribution-NonCommercial 4.0 International License](http://creativecommons.org/licenses/by-nc/4.0/).

p5.js is licensed separately under the LGPL.