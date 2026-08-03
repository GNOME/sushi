import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import {programInvocationName, programArgs, exit} from 'system';
import GtkSource from 'gi://GtkSource';

Gio._promisify(GtkSource.FileLoader.prototype, 'load_async', 'load_finish');

export async function main(argv) {
    try {
        const application = new Application();
        await application.runAsync(argv);
    } catch (error) {
        console.error(error);
        exit(1);
    }
}

class Application extends Gtk.Application {
    static {
        GObject.registerClass(this);
    }

    constructor(constructProperties = {}) {
        super(constructProperties);
        this.set_accels_for_action('app.quit', ['<primary>q']);
        this.add_action_entries([{
            name: 'quit',
            activate: () => this.quit(),
        }]);
    }

    vfunc_activate() {
        super.vfunc_activate();
        const window = this.activeWindow ?? new MainWindow({application: this});
        window.present();
    }
}

const template = `
    <?xml version="1.0" encoding="UTF-8"?>
    <interface>
        <requires lib="gtk" version="4.0"/>
        <requires lib="adw" version="1.0" />
        <requires lib="gtksourceview" version="1.0" />
        <template class="Gjs_MainWindow" parent="GtkApplicationWindow">
            <child>
                <object class="GtkBox" id="container">
                    <property name="orientation">vertical</property>
                    <child>
                        <object class="GtkLabel" id="label" />
                    </child>
                    <child>
                        <object class="GtkButton" id="button">
                            <property name="label">A</property>
                        </object>
                    </child>
                    <child>
                        <object class="GtkButton" id="button2">
                            <property name="label">B</property>
                        </object>
                    </child>
                </object>
            </child>
        </template>
    </interface>
`;
class MainWindow extends Gtk.ApplicationWindow {
    static {
        GObject.type_ensure(GtkSource.View);
        GObject.registerClass({
            Template: new TextEncoder().encode(template),
            Children: ['label', 'button', 'button2', 'container'],
        }, this);
    }

    constructor(constructProperties = {}) {
        super({
            widthRequest: 340,
            heightRequest: 294,
            gravity: Gtk.WindowGravity.CENTER,
            ...constructProperties,
        });
        this.label.label = `Hello World: ${Math.random()}`;
        this.button.connect('clicked', () => {
            // const buffer = new GtkSource.Buffer();
            // buffer.set_style_scheme(GtkSource.StyleSchemeManager.get_default().get_scheme('Adwaita'));
            // const langManager = GtkSource.LanguageManager.get_default();
            // buffer.set_language(langManager.get_language('javascript'));
            // const sourceFile = new GtkSource.File({location: Gio.File.new_for_path('repro.js')});
            // const loader = new GtkSource.FileLoader({
            //     buffer,
            //     file: sourceFile,
            // });
            // const view = new GtkSource.View({
            //     buffer,
            //     editable: false,
            //     cursor_visible: false,
            //     monospace: true,
            //     left_margin: 12,
            //     right_margin: 12,
            //     top_margin: 12,
            //     bottom_margin: 12,
            // });
            const scrolledWindow = new Gtk.ScrolledWindow({
                widthRequest: 500,
                // heightRequest: 500,
                propagateNaturalHeight: true,
                propagateNaturalWidth: true,
            });
            const buffer = new Gtk.TextBuffer({
                text: `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim aeque doleamus animo, cum corpore dolemus, fieri tamen permagna accessio potest, si aliquod aeternum et infinitum impendere malum nobis opinemur. Quod idem licet.

                Voluptatem. Ut enim sapientiam, temperantiam, fortitudinem copulatas esse docui cum voluptate, ut ab ipsis, qui eam disciplinam probant, non soleat accuratius explicari; verum enim invenire volumus, non tamquam adversarium aliquem convincere. Accurate autem quondam a L. Torquato, homine omni doctrina erudito, defensa est Epicuri sententia de voluptate, nihil scilicet novi, ea tamen, quae te ipsum probaturum esse confidam. Certe, inquam, pertinax non ero tibique, si mihi probabis ea.

                Sit, sublatum esse omne iudicium veri et falsi putat. Confirmat autem illud vel maxime, quod ipsa natura divitias, quibus contenta sit, et parabilis et terminatas habet; inanium autem cupiditatum nec modus ullus nec finis inveniri potest. Quodsi vitam omnem continent, neglegentur? Nam, ut.`,
            });
            scrolledWindow.set_child(new Gtk.TextView({buffer, wrapMode: Gtk.WrapMode.WORD}));
            this.container.append(scrolledWindow);
            // setTimeout(() => this.set_default_size(-1, -1), 4000);
            // loader
            //     .load_async(GLib.PRIORITY_DEFAULT, null, null)
            //     .catch(error => console.error(error));
        });
        this.button2.connect('clicked', () => {
            this.container.append(new Gtk.Box({
                widthRequest: 500,
                heightRequest: 500,
            }));
        });
    }
}

main([programInvocationName, ...programArgs]);
