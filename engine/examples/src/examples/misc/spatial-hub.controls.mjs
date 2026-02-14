/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput, BooleanInput } = ReactPCUI;

    return fragment(
        jsx(
            Panel,
            { headerText: 'Spatial Hub' },
            jsx(
                LabelGroup,
                { text: 'Walk Speed' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'hub.walkSpeed' },
                    min: 2,
                    max: 14,
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Sprint Mult' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'hub.sprintMultiplier' },
                    min: 1,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Look Sensitivity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'hub.lookSensitivity' },
                    min: 0.03,
                    max: 0.4,
                    precision: 3
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Enable Video Wall' },
                jsx(BooleanInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'hub.videoEnabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Video Volume' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'hub.videoVolume' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Screen Distance' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'hub.floatingScreenDistance' },
                    min: 2.5,
                    max: 18,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Screen Scale' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'hub.floatingScreenScale' },
                    min: 0.45,
                    max: 2.3,
                    precision: 2
                })
            )
        )
    );
};