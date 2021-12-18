module Pages.Home_ exposing (Model, Msg, page)

import Effect exposing (Effect)
import Element as E exposing (..)
import Element.Border as B
import Element.Font as F
import Element.Input as I
import Gen.Params.Home_ exposing (Params)
import Gen.Route
import Page
import Request
import Shared
import Simple.Transition as Transition
import Styling exposing (..)
import View exposing (View)


page : Shared.Model -> Request.With Params -> Page.With Model Msg
page _ req =
    Page.advanced
        { init = init
        , update = update req
        , view = view
        , subscriptions = subscriptions
        }



-- INIT


type alias Model =
    {}


init : ( Model, Effect Msg )
init =
    ( {}, Effect.none )



-- UPDATE


type Msg
    = GoToCreatePage
    | GoToDemoLandingPage


update : Request.With Params -> Msg -> Model -> ( Model, Effect Msg )
update req msg model =
    case msg of
        GoToCreatePage ->
            ( model, Effect.fromCmd (Request.pushRoute Gen.Route.Create req) )

        GoToDemoLandingPage ->
            ( model, Effect.fromCmd (Request.pushRoute Gen.Route.DemoLanding req) )



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.none



-- VIEW


buttonAttrs : E.Color -> List (Attribute Msg)
buttonAttrs hoverColor =
    [ B.color gray
    , B.width 1
    , B.rounded 5
    , F.center
    , padding 15
    , width (E.fill |> E.minimum 800)
    , height (px 65)
    , mouseDown
        [ B.color skyBlue
        , B.shadow
            { offset = ( -2, -2 )
            , size = 0
            , blur = 0
            , color = skyBlue
            }
        ]
    , E.htmlAttribute <|
        Transition.properties
            [ Transition.borderColor 200 []
            , Transition.property "box-shadow" 200 [ Transition.easeOut ] -- naughty
            ]
    , mouseOver
        [ B.color hoverColor
        , B.shadow
            { offset = ( -3, -3 )
            , size = 1
            , blur = 0
            , color = hoverColor
            }
        ]
    ]


body : Model -> Element Msg
body _ =
    el [ centerX ] <|
        column [ width fill, height fill, padding 120, F.family [ F.typeface "Helvetica Neue" ] ]
            [ el [ paddingXY 15 40, F.size 48 ] (text "Compute")
            , column []
                [ el [ padding 15, F.size 24 ]
                    (I.button
                        (buttonAttrs vividViolet)
                        { onPress = Just GoToCreatePage
                        , label = E.text "Create a raw query (advanced)"
                        }
                    )
                , el [ padding 15, F.size 24 ]
                    (I.button
                        (buttonAttrs vividViolet)
                        { onPress = Just GoToDemoLandingPage
                        , label = E.text "Go to demo landing page (the thing you saw in the videos)"
                        }
                    )
                ]
            ]


view : Model -> View Msg
view model =
    { title = "Compute | Home"
    , element = body model
    }
